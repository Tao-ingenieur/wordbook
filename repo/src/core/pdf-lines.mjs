export function pdfLines(items, options = {}) {
  const content = items.filter(i => i.str && i.str.trim());
  // 双栏讲义：两个反复出现的英文行首，且第二个接近页面中线。
  // 使用行首频率而非简单居中切割，避免把常规四列表格误拆成两栏。
  if (!options.singleColumn && content.length > 30) {
    const minX = Math.min(...content.map(i => i.transform[4]));
    const maxX = Math.max(...content.map(i => i.transform[4] + (i.width || 0)));
    const bins = new Map();
    for (const item of content.filter(i => /^[a-zA-Z]/.test(i.str.trim()))) {
      const bin = Math.round(item.transform[4] / 8) * 8;
      const data = bins.get(bin) || { count: 0, x: 0 };
      data.count++; data.x += item.transform[4]; bins.set(bin, data);
    }
    const left = [...bins.entries()].filter(([x]) => x < minX + 16).sort((a, b) => b[1].count - a[1].count)[0];
    const middle = [...bins.entries()].filter(([x, v]) => x > minX + (maxX - minX) * .35 && x < minX + (maxX - minX) * .65 && v.count >= Math.max(8, (left?.[1].count || 0) * .6)).sort((a, b) => b[1].count - a[1].count)[0];
    if (left && middle) {
      const boundary = middle[1].x / middle[1].count - 3;
      return [...pdfLines(content.filter(i => i.transform[4] < boundary), { singleColumn: true }), ...pdfLines(content.filter(i => i.transform[4] >= boundary), { singleColumn: true })];
    }
  }
  const rows = [];
  for (const item of content) {
    const y = item.transform[5];
    let row = rows.find(r => Math.abs(r.y - y) < 3);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  return rows.sort((a, b) => b.y - a.y).map(row => {
    const sorted = row.items.sort((a, b) => a.transform[4] - b.transform[4]);
    return sorted.map((item, i) => {
      const prev = sorted[i - 1];
      const gap = prev ? item.transform[4] - prev.transform[4] - (prev.width || 0) : 0;
      return `${i ? gap > 12 ? '  ' : ' ' : ''}${item.str}`;
    }).join('');
  });
}
