export interface DiffSummary {
  additions: number;
  deletions: number;
  filesChanged: number;
}

export function parseGitDiffStat(rawStat: string): DiffSummary {
  if (!rawStat) return { additions: 0, deletions: 0, filesChanged: 0 };
  const addMatch = rawStat.match(/(\d+)\s+insertion/);
  const delMatch = rawStat.match(/(\d+)\s+deletion/);
  const fileMatch = rawStat.match(/(\d+)\s+file/);
  return {
    additions: addMatch ? parseInt(addMatch[1], 10) : 0,
    deletions: delMatch ? parseInt(delMatch[1], 10) : 0,
    filesChanged: fileMatch ? parseInt(fileMatch[1], 10) : 0,
  };
}
