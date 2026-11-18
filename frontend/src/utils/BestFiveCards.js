// Mirrors the server's seven-card evaluator. Used only for visual highlighting.
// The server remains authoritative for winners and payouts.
const VALUES = { Ace:14, King:13, Queen:12, Jack:11, A:14, K:13, Q:12, J:11, '1':14, '11':11, '12':12, '13':13 };
const value = rank => VALUES[String(rank)] ?? Number(rank);
function straightHigh(ranks) {
  const unique = [...new Set(ranks)].sort((a,b) => b-a);
  if (unique.includes(14)) unique.push(1);
  for (let i=0; i<=unique.length-5; i++) if (unique[i]-unique[i+4]===4) return unique[i];
  return 0;
}
function rankFive(cards) {
  const ranks = cards.map(c => value(c.rank)).sort((a,b)=>b-a);
  const counts = new Map();
  for (const rank of ranks) counts.set(rank,(counts.get(rank)||0)+1);
  const groups = [...counts.entries()].sort(([a,ca],[b,cb])=>cb-ca||b-a);
  const flush = cards.every(c=>c.suit===cards[0].suit);
  const straight = straightHigh(ranks);
  if (flush && straight) return [8,straight];
  if (groups[0][1]===4) return [7,groups[0][0],groups[1][0]];
  if (groups[0][1]===3 && groups[1][1]===2) return [6,groups[0][0],groups[1][0]];
  if (flush) return [5,...ranks];
  if (straight) return [4,straight];
  if (groups[0][1]===3) return [3,groups[0][0],...groups.slice(1).map(([r])=>r).sort((a,b)=>b-a)];
  const pairs = groups.filter(([,n])=>n===2).map(([r])=>r).sort((a,b)=>b-a);
  if (pairs.length===2) return [2,...pairs,groups.find(([,n])=>n===1)[0]];
  if (pairs.length===1) return [1,pairs[0],...groups.filter(([,n])=>n===1).map(([r])=>r).sort((a,b)=>b-a)];
  return [0,...ranks];
}
function compare(a,b) {
  for(let i=0;i<Math.max(a.length,b.length);i++) if((a[i]||0)!==(b[i]||0)) return (a[i]||0)-(b[i]||0);
  return 0;
}
export function bestFiveIndices(cards) {
  if (!Array.isArray(cards) || cards.length < 5 || cards.some(c=>!c || c.rank==null || c.suit==null || !Number.isFinite(value(c.rank)))) return null;
  let best=null, indices=null;
  for(let a=0;a<cards.length-4;a++) for(let b=a+1;b<cards.length-3;b++)
  for(let c=b+1;c<cards.length-2;c++) for(let d=c+1;d<cards.length-1;d++)
  for(let e=d+1;e<cards.length;e++) {
    const selection=[a,b,c,d,e];
    const rank=rankFive(selection.map(i=>cards[i]));
    if (!best || compare(rank,best)>0) {best=rank;indices=selection;}
  }
  return indices;
}
