interface InputProps {
  type?: string;
  placeholder?: string;
  label?: string;
}

export default function Input({
  type = "text",
  placeholder,
  label,
}: InputProps) {
  return (
    <div>
      {label && (
        <label className="block mb-2 font-medium">
          {label}
        </label>
      )}

      <input
        type={type}
        placeholder={placeholder}
        className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
    </div>
  );
}