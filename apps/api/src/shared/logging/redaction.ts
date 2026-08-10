export const maskIdentifier = (value: string) =>
  value.length <= 8 ? "[short-id]" : `${value.slice(0, 4)}...${value.slice(-4)}`;
