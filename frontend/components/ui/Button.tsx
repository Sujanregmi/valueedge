interface ButtonProps {
  children: React.ReactNode;
  type?: "button" | "submit";
}

export default function Button({
  children,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700"
    >
      {children}
    </button>
  );
}