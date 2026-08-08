export default function FilterBar(){

  return (

    <div className="bg-white p-5 rounded-xl shadow flex flex-wrap gap-4">


      <select className="border p-3 rounded-lg">
        <option>
          All Sports
        </option>
        <option>
          Football
        </option>
        <option>
          NBA
        </option>
      </select>


      <select className="border p-3 rounded-lg">
        <option>
          All Bookmakers
        </option>
        <option>
          Bet365
        </option>
        <option>
          PointsBet
        </option>
      </select>


      <select className="border p-3 rounded-lg">
        <option>
          Minimum Edge
        </option>
        <option>
          5%
        </option>
        <option>
          10%
        </option>
      </select>


    </div>

  );

}