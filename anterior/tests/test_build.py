import json, tempfile, sys
from pathlib import Path
import pandas as pd
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_data import build,DATES

def test():
 with tempfile.TemporaryDirectory() as tmp:
  root=Path(tmp);(root/'config').mkdir();(root/'insumos').mkdir()
  cfg={'output_dir':'data','sources':{}}
  for key,dt in DATES.items():
   data=[{'CLUES':'AA001',dt:'02/10/2025'},{'CLUES':'AA001',dt:'02/10/2026'},{'CLUES':'ONLY_'+key,dt:'02/10/2026'},{'CLUES':'AA001',dt:'08/10/2026'},{'CLUES':'',dt:''}]
   path=root/'insumos'/f'{key}.xlsx' if key=='eds_moce' else root/'insumos'/f'{key}.csv'
   if path.suffix=='.xlsx':pd.DataFrame(data).to_excel(path,index=False)
   else:pd.DataFrame(data).to_csv(path,index=False)
   cfg['sources'][key]={'path':f'insumos/{path.name}','clues_column':'clues','date_column':dt}
  cp=root/'config'/'sources.json';cp.write_text(json.dumps(cfg))
  results=build(cp,'2026-10-08');assert len(results)==10
  assert all(x['clues_compartidas']==1 for x in results)
  assert results[0]['sinba_total']==1 and results[0]['eds_total']==1
  assert results[1]['sinba_total']==4 and results[1]['eds_total']==1
  assert results[2]['sinba_total']==1
  audit=json.loads((root/'data'/'resumen_calidad.json').read_text())
  assert audit['fuentes']['sinba_ce']['fecha_invalida']==1
  assert audit['fuentes']['sinba_ce']['fuera_periodo']==1
  assert audit['auditoria_clues']['Consulta externa']['clues_compartidas']==1
  print('OK: 10 escenarios, CSV + Excel, corte semanal, cohorte y auditoría')
if __name__=='__main__':test()
