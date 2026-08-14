interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      style={{
        padding: "0.75rem",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "var(--radius)",
        color: "var(--danger)",
        fontSize: "0.875rem",
        marginBottom: "1rem",
      }}
    >
      {message}
    </div>
  );
}
