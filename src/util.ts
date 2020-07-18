export function wait(ms: number): Promise<NodeJS.Timeout> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// The conversion formula assumes a molecular mass of 111.86 g/mol, 25°C and 1.013 bar.
// The molecular mass is the average molecular mass of the TVOC reference gas mixture.

export function vocDensity(tvoc: number): number {
  return tvoc * 111.86 / 24.45;
}
