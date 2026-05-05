type ErrorLogFields = {
  name: string;
  message: string;
  code?: string;
  statusCode?: number;
};

export const maskIdentifier = (value: string) =>
  value.length <= 8 ? "[short-id]" : `${value.slice(0, 4)}...${value.slice(-4)}`;

export const errorLogFields = (error: Error): ErrorLogFields => {
  const withMetadata = error as Error & {
    code?: unknown;
    statusCode?: unknown;
  };

  return {
    name: error.name,
    message: error.message,
    ...(typeof withMetadata.code === "string" ? { code: withMetadata.code } : {}),
    ...(typeof withMetadata.statusCode === "number" ? { statusCode: withMetadata.statusCode } : {}),
  };
};
