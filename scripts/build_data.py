"""SINBA–EDS v2: CSV, XLSX/XLS, Parquet -> weekly privacy-safe JSON.
Run from project root: python scripts/build_data.py --config config/sources.json --as-of 2026-10-08
"""
import argparse, json, glob, re
from pathlib import Path
from datetime import date, timedelta
import pandas as pd

SINBA_CE=['sinba_ce','sinba_pf','sinba_sm','sinba_sb']
SINBA_PROC=['sinba_proc','sinba_proc_q']
AREA={'Consulta externa':(SINBA_CE,'eds_moce'),'Cirugías':(SINBA_PROC,'eds_cir'),'Hospitalizaciones':(['sinba_egr'],'eds_hosp')}
SCENARIOS=[('ce_2025','Consulta externa',['sinba_ce'],2025,'eds_moce'),('integral_2025','Consulta externa',SINBA_CE,2025,'eds_moce'),('ce_2026','Consulta externa',['sinba_ce'],2026,'eds_moce'),('integral_2026','Consulta externa',SINBA_CE,2026,'eds_moce'),('proc_2025','Cirugías',['sinba_proc'],2025,'eds_cir'),('proc_total_2025','Cirugías',SINBA_PROC,2025,'eds_cir'),('proc_2026','Cirugías',['sinba_proc'],2026,'eds_cir'),('proc_total_2026','Cirugías',SINBA_PROC,2026,'eds_cir'),('egr_2025','Hospitalizaciones',['sinba_egr'],2025,'eds_hosp'),('egr_2026','Hospitalizaciones',['sinba_egr'],2026,'eds_hosp')]
DATES={k:('fecha_consulta' if k in SINBA_CE else 'fecha_egreso' if k.startswith('sinba_') else 'fecha_atencion' if k=='eds_moce' else 'Fecha de Realización' if k=='eds_cir' else 'fecha_hora_egreso') for k in {x for v in AREA.values() for x in v[0]+[v[1]]}}

def colname(columns,requested):
    norm=lambda s: re.sub(r'\s+',' ',str(s).strip()).casefold()
    matches=[x for x in columns if norm(x)==norm(requested)]
    if len(matches)!=1: raise ValueError(f'Columna {requested!r}: coincidencias {matches}; disponibles: {list(columns)}')
    return matches[0]

def csv_chunks(path, cfg):
    """Read CSV in chunks, validating encoding over the whole file first."""
    import csv

    specified = cfg.get('encoding')
    candidates = [specified] if specified else ['utf-8-sig', 'utf-8', 'cp1252', 'latin-1']
    encoding = None
    for candidate in candidates:
        try:
            with open(path, 'r', encoding=candidate, errors='strict', newline='') as fh:
                for block in iter(lambda: fh.read(1024 * 1024), ''):
                    pass
            encoding = candidate
            break
        except UnicodeError:
            continue
    if encoding is None:
        raise ValueError(f'No se pudo decodificar CSV {path} con las codificaciones {candidates}')

    sep = cfg.get('separator')
    if not sep:
        with open(path, 'r', encoding=encoding, newline='') as fh:
            sample = fh.read(65536)
        try:
            sep = csv.Sniffer().sniff(sample, delimiters=',;\t|').delimiter
        except csv.Error:
            sep = ','
    print(f'CSV: {path.name} | encoding={encoding} | separador={sep!r}', flush=True)
    return pd.read_csv(
        path, sep=sep, encoding=encoding, dtype=str,
        chunksize=int(cfg.get('chunksize', 100000)),
        low_memory=False, on_bad_lines='error'
    )

def frames(path,cfg):
    suffix=path.suffix.lower()
    if suffix=='.csv':yield from csv_chunks(path,cfg)
    elif suffix in ('.xlsx','.xls'):
        # Excel is read in memory; for very large inputs prefer CSV or Parquet.
        yield pd.read_excel(path,sheet_name=cfg.get('sheet',0),dtype=str)
    elif suffix=='.parquet':
        import pyarrow.parquet as pq
        pf=pq.ParquetFile(path)
        for batch in pf.iter_batches(batch_size=int(cfg.get('chunksize',100000))):yield batch.to_pandas()
    else:raise ValueError(f'Formato no soportado: {path}')

def parse_dates(series):
    s=series.astype('string').str.strip().replace({'':'', 'nan':''})
    out=pd.Series(pd.NaT,index=series.index,dtype='datetime64[ns]')
    for fmt in ['%d/%m/%Y','%d/%m/%Y %H:%M:%S','%Y-%m-%d','%Y-%m-%d %H:%M:%S','%Y-%m-%dT%H:%M:%S','%Y-%m-%d %H:%M:%S.%f','%Y-%m-%dT%H:%M:%S.%f']:
        mask=out.isna() & s.notna() & s.ne('')
        if mask.any():out.loc[mask]=pd.to_datetime(s.loc[mask],format=fmt,errors='coerce')
    return out

def read_source(key,cfg,root,end):
    # SINBA: paths por año; EDS y configuraciones anteriores: path.
    specs = cfg.get('paths')
    if specs is not None:
        if not isinstance(specs, dict) or not all(y in specs for y in ('2025', '2026')):
            raise ValueError(f'{key}: paths debe incluir 2025 y 2026')
        candidates = [(int(year), spec) for year, spec in specs.items()]
    elif 'path' in cfg:
        candidates = [(None, cfg['path'])]
    else:
        raise ValueError(f'{key}: define path o paths')
    paths = []
    for expected_year, spec in candidates:
        if not isinstance(spec, str) or not spec.strip():
            raise ValueError(f'{key}: ruta vacía para {expected_year}')
        pattern = Path(spec)
        pat = str(pattern if pattern.is_absolute() else root / pattern)
        found = [Path(x) for x in sorted(glob.glob(pat))]
        if not found:
            raise FileNotFoundError(f'{key} ({expected_year}): no se encontraron archivos: {pat}')
        paths.extend((x, expected_year) for x in found)
    if len({str(p.resolve()) for p, _ in paths}) != len(paths):
        raise ValueError(f'{key}: un mismo archivo está declarado más de una vez')
    counts={};monthly_counts={};stats={'total':0,'clues_faltante':0,'fecha_invalida':0,'ambas_faltantes':0,'fuera_periodo':0,'registros_fecha_valida_clues_valida_periodo':0}
    stats['anio_no_corresponde_archivo']=0
    audit_by_clues={}
    for path, expected_year in paths:
        for df in frames(path,cfg):
            cc=colname(df.columns,cfg.get('clues_column','clues'));dc=colname(df.columns,cfg.get('date_column',DATES[key]))
            clues=df[cc].astype('string').str.strip().str.upper().str.replace(r'\s+','',regex=True)
            bad_clues=clues.isna()|clues.isin(['','NAN','NONE','NULL','<NA>'])
            dates=parse_dates(df[dc]);bad_dates=dates.isna()
            # Auditoría por CLUES antes de excluir fechas: necesaria para filtros coherentes.
            audit_frame=pd.DataFrame({'clues':clues,'bad_clues':bad_clues,'bad_dates':bad_dates,'dates':dates})
            for c,group in audit_frame.loc[~bad_clues].groupby('clues',sort=False):
                a=audit_by_clues.setdefault(str(c),{'total':0,'fecha_invalida':0,'fuera_periodo':0,'anio_no_corresponde_archivo':0,'validos':0})
                a['total']+=len(group);a['fecha_invalida']+=int(group.bad_dates.sum())
                valid=~group.bad_dates
                wrong=(group.dates.dt.year.ne(expected_year)&valid) if expected_year is not None else pd.Series(False,index=group.index)
                a['anio_no_corresponde_archivo']+=int(wrong.sum())
                within=valid&~wrong&group.dates.ge(pd.Timestamp('2025-01-01'))&group.dates.le(pd.Timestamp(end))
                a['fuera_periodo']+=int((valid&~wrong&~within).sum());a['validos']+=int(within.sum())
            stats['total']+=len(df);stats['clues_faltante']+=int(bad_clues.sum());stats['fecha_invalida']+=int(bad_dates.sum());stats['ambas_faltantes']+=int((bad_clues&bad_dates).sum())
            good=~bad_clues & ~bad_dates
            if expected_year is not None:
                wrong_year = good & dates.dt.year.ne(expected_year)
                stats['anio_no_corresponde_archivo'] += int(wrong_year.sum())
                good = good & ~wrong_year
            inrange=good & dates.ge(pd.Timestamp('2025-01-01')) & dates.le(pd.Timestamp(end))
            stats['fuera_periodo']+=int((good&~inrange).sum());stats['registros_fecha_valida_clues_valida_periodo']+=int(inrange.sum())
            if inrange.any():
                d=pd.DataFrame({'clues':clues.loc[inrange],'fecha':dates.loc[inrange]})
                iso=d['fecha'].dt.isocalendar()
                d['year']=iso.year.astype(int);d['week']=iso.week.astype(int)
                for (c,y,w),n in d.groupby(['clues','year','week'],sort=False).size().items():counts[(str(c),int(y),int(w))]=counts.get((str(c),int(y),int(w)),0)+int(n)
                d['calendar_year']=d['fecha'].dt.year.astype(int)
                d['month']=d['fecha'].dt.month.astype(int)
                for (c,y,m),n in d.groupby(['clues','calendar_year','month'],sort=False).size().items():
                    monthly_counts[(str(c),int(y),int(m))]=monthly_counts.get((str(c),int(y),int(m)),0)+int(n)
        print(f'{key}: {path.name} leído')
    return counts,stats,audit_by_clues,monthly_counts

def last_full_sunday(today):return today-timedelta(days=today.weekday()+1)

def build(config_path,as_of=None):
    config_path=Path(config_path).resolve();cfg=json.loads(config_path.read_text(encoding='utf-8'));root=config_path.parent.parent
    today=date.fromisoformat(as_of) if as_of else date.today();end=min(last_full_sunday(today),date(2026,12,27))
    if end<date(2026,1,4):raise ValueError('Aún no hay semanas ISO completas de 2026')
    maxweek=end.isocalendar().week
    sources=cfg['sources'];missing=set(DATES)-set(sources)
    if missing:raise ValueError('Faltan fuentes: '+', '.join(sorted(missing)))
    grouped={};quality={};audit_clues={};monthly_grouped={}
    for k in DATES:
        grouped[k],quality[k],audit_clues[k],monthly_grouped[k]=read_source(k,sources[k],root,end)
    cohorts={};audit={};weekly={};exclusions={};catalogos_clues={}
    for area,(left,right) in AREA.items():
        s=set().union(*(set(c for c,y,w in grouped[k] if y==2026) for k in left))
        e=set(c for c,y,w in grouped[right] if y==2026)
        cohort=s&e;cohorts[area]=cohort
        audit[area]={'clues_sinba':len(s),'clues_eds':len(e),'clues_compartidas':len(cohort),'clues_solo_sinba':len(s-e),'clues_solo_eds':len(e-s)}
        catalogos_clues[area]={'sinba':sorted(s),'eds':sorted(e),'coincidentes':sorted(cohort)}
        for k in left+[right]:
            counter={};excluded=0
            for (c,y,w),n in grouped[k].items():
                if c in cohort:counter[(y,w)]=counter.get((y,w),0)+n
                else:excluded+=n
            weekly[k]=counter;exclusions[k]={'registros_excluidos_por_no_pertenecer_al_cruce':excluded}
    # Desglose por CLUES del universo común, conservando ceros en semanas sin actividad.
    detalle_clues = {}
    for area, (left, right) in AREA.items():
        detalle_clues[area] = {}
        for clues in sorted(cohorts[area]):
            detalle_clues[area][clues] = {}
            for key in left + [right]:
                values = {}
                for (c, y, w), n in grouped[key].items():
                    if c == clues and y in (2025, 2026) and 1 <= w <= maxweek:
                        values[f'{y}-{w}'] = n
                if values:
                    detalle_clues[area][clues][key] = values
    out=Path(cfg.get('output_dir','data'));out=out if out.is_absolute() else root/out;out.mkdir(parents=True,exist_ok=True)
    # Meses calendario exactos; no se infieren a partir de semanas ISO.
    detalle_mensual={}
    for area,(left,right) in AREA.items():
        detalle_mensual[area]={}
        for clue in sorted(cohorts[area]):
            detalle_mensual[area][clue]={}
            for key in left+[right]:
                values={}
                for (c,y,m),n in monthly_grouped[key].items():
                    if c==clue and y in (2025,2026):
                        values[f'{y}-{m:02d}']=n
                if values:detalle_mensual[area][clue][key]=values
    (out/'detalle_mensual.json').write_text(json.dumps({'areas':detalle_mensual,'nota':'Conteos por mes calendario, cortados a la última semana ISO completa de 2026; meses de 2025 completos hasta el mes de corte.'},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    results=[]
    for sid,area,left,year,right in SCENARIOS:
        series=[{'week':w,'sinba':sum(weekly[k].get((year,w),0) for k in left),'eds':weekly[right].get((2026,w),0)} for w in range(1,maxweek+1)]
        results.append({'id':sid,'area':area,'sinba_sources':left,'sinba_year':year,'eds_source':right,'eds_year':2026,'clues_compartidas':len(cohorts[area]),'series':series,'sinba_total':sum(r['sinba'] for r in series),'eds_total':sum(r['eds'] for r in series)})
    meta={'fecha_proceso':today.isoformat(),'ultima_semana_completa':end.isoformat(),'ultima_semana_iso':maxweek,'semana_iso_anio':2026,'metodo_cruce':'Intersección fija por área: CLUES con actividad en SINBA 2026 y EDS 2026','nota':'Se cuentan filas, no eventos clínicos deduplicados; escenarios CE simples conservados para auditoría'}
    # Auditoría por CLUES filtrable; sin CLUES se informa por separado como dato global.
    quality_by_clues={}
    for area,(left,right) in AREA.items():
        quality_by_clues[area]={}
        for c in sorted(cohorts[area]):
            quality_by_clues[area][c]={}
            for k in left+[right]:
                entry=dict(audit_clues[k].get(c,{'total':0,'fecha_invalida':0,'fuera_periodo':0,'anio_no_corresponde_archivo':0,'validos':0}))
                entry['clues_faltante']=0
                entry['excluidas_cruce']=0
                quality_by_clues[area][c][k]=entry
    (out/'auditoria_clues.json').write_text(json.dumps({'areas':quality_by_clues,'nota':'La auditoría filtrada solo incluye CLUES válidas de la cohorte común. Registros sin CLUES no pueden asignarse a entidad o unidad. Las exclusiones del cruce se consultan en el resumen global.'},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    (out/'detalle_clues.json').write_text(json.dumps({'metadata': {'ultima_semana_iso':maxweek, 'nota':'Conteos por CLUES y semana; publicar únicamente en un entorno autorizado'}, 'areas':detalle_clues},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    (out/'series_semanales.json').write_text(json.dumps({'metadata':meta,'escenarios':results},ensure_ascii=False,indent=2),encoding='utf-8')
    (out/'resumen_calidad.json').write_text(json.dumps({'fuentes':quality,'exclusiones_cruce':exclusions,'cohortes':{a:len(c) for a,c in cohorts.items()},'catalogos_clues':catalogos_clues,'auditoria_clues':audit,'advertencias':['Módulos SINBA sumados pueden contener eventos repetidos.','La cohorte se establece con actividad de ambos sistemas en 2026.','Las exclusiones por CLUES y fecha pueden solaparse.']},ensure_ascii=False,indent=2),encoding='utf-8')
    print('JSON generados en',out)
    return results

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--config',default='config/sources.json');p.add_argument('--as-of');a=p.parse_args();build(a.config,a.as_of)
