type Props = {
  title: string;
  value: string;
};

export default function StatsCard({ title, value }: Props) {

  return (
    <div className="bg-white p-6 rounded-xl shadow">

      <h2 className="font-semibold text-gray-600">
        {title}
      </h2>

      <p className="text-3xl font-bold mt-3">
        {value}
      </p>

    </div>
  );
}