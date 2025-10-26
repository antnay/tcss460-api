export const errorHandler = (err: any, req: any, res: any, next: any) => {
  console.error("Error:", err.message);

  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
    timestamp: Date.now()
  });
};
