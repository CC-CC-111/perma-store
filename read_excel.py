import pandas as pd
import sys
import json

df = pd.read_excel(r'c:\Users\srfges\WorkBuddy\20260711111147\简介.xlsx', header=None)

rows = []
for i, row in df.iterrows():
    vals = [str(v) if pd.notna(v) else "" for v in row]
    rows.append(vals)

# Output as JSON to avoid encoding issues
output = {
    "rows": len(df),
    "cols": df.shape[1],
    "data": rows
}

with open(r'c:\Users\srfges\WorkBuddy\20260711111147\excel_data.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print("Done, data written to excel_data.json")
