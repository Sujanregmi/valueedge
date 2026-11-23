"use client";

import { useEffect, useState } from "react";

import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";

const API_URL = "http://127.0.0.1:8000";

type Bookmaker = {
  id: number;
  name: string;
  balance: number;
};

type KnownBookmaker = {
  key: string;
  name: string;
};

type BookmakerRow = {
  id?: number;
  name: string;
  balance: string;
  isCustom?: boolean;
};

export default function BookmakersPage() {
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [knownBookmakers, setKnownBookmakers] =
    useState<KnownBookmaker[]>([]);

  const [rows, setRows] = useState<BookmakerRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] =
    useState<string | null>(null);

  const [newName, setNewName] = useState("");

  function buildBookmakerRows(
    saved: Bookmaker[],
    known: KnownBookmaker[]
  ) {
    const map = new Map<string, BookmakerRow>();

    // --------------------------------------------
    // FIRST: Odds API supported bookmakers
    // --------------------------------------------
    known.forEach((bookmaker) => {
      map.set(bookmaker.name.toLowerCase(), {
        name: bookmaker.name,
        balance: "0",
      });
    });

    // --------------------------------------------
    // THEN: existing bookmaker accounts
    // Existing DB values override the zero values.
    // --------------------------------------------
    saved.forEach((bookmaker) => {
      map.set(bookmaker.name.toLowerCase(), {
        id: bookmaker.id,
        name: bookmaker.name,
        balance: bookmaker.balance.toString(),
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async function loadBookmakers() {
    setLoading(true);

    try {
      const [savedRes, knownRes] = await Promise.all([
        fetch(`${API_URL}/bookmakers`, {
          credentials: "include",
          cache: "no-store",
        }),

        fetch(`${API_URL}/bookmakers/known-names`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (savedRes.status === 401 || knownRes.status === 401) {
        setError("Session expired — please log in again.");
        return;
      }

      if (!savedRes.ok) {
        throw new Error(
          `Unable to load bookmaker accounts: ${savedRes.status}`
        );
      }

      if (!knownRes.ok) {
        throw new Error(
          `Unable to load bookmaker list: ${knownRes.status}`
        );
      }

      const savedData: Bookmaker[] =
        await savedRes.json();

      const knownData = await knownRes.json();

      const knownList: KnownBookmaker[] =
        knownData.bookmakers ?? [];

      setBookmakers(savedData);
      setKnownBookmakers(knownList);

      setRows(
        buildBookmakerRows(
          savedData,
          knownList
        )
      );

      setError(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load bookmakers";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookmakers();
  }, []);

  // ==================================================
  // ADD CUSTOM BOOKMAKER TO THE PAGE
  // Nothing is saved yet.
  // ==================================================
  function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    const name = newName.trim();

    if (!name) return;

    const alreadyExists = rows.some(
      (bookmaker) =>
        bookmaker.name.toLowerCase() ===
        name.toLowerCase()
    );

    if (alreadyExists) {
      setError(
        `${name} is already in the bookmaker list.`
      );
      return;
    }

    setRows((current) =>
      [
        ...current,
        {
          name,
          balance: "0",
          isCustom: true,
        },
      ].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );

    setNewName("");
    setSavedMessage(null);
    setError(null);
  }

  // ==================================================
  // UPDATE BALANCE LOCALLY
  // ==================================================
  function updateBalance(
    bookmakerName: string,
    value: string
  ) {
    setRows((current) =>
      current.map((row) =>
        row.name === bookmakerName
          ? {
              ...row,
              balance: value,
            }
          : row
      )
    );

    setSavedMessage(null);
  }

  // ==================================================
  // REMOVE UNSAVED CUSTOM BOOKMAKER
  // ==================================================
  function removeUnsavedBookmaker(name: string) {
    setRows((current) =>
      current.filter(
        (row) =>
          !(
            row.name === name &&
            !row.id
          )
      )
    );

    setSavedMessage(null);
  }

  // ==================================================
  // DELETE SAVED BOOKMAKER
  // ==================================================
  async function deleteSavedBookmaker(
    bookmaker: BookmakerRow
  ) {
    if (!bookmaker.id) {
      removeUnsavedBookmaker(bookmaker.name);
      return;
    }

    const confirmed = window.confirm(
      `Remove ${bookmaker.name}?`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(
        `${API_URL}/bookmakers/${bookmaker.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!res.ok && res.status !== 204) {
        throw new Error(
          `Unable to remove ${bookmaker.name}`
        );
      }

      await loadBookmakers();

      setSavedMessage(
        `${bookmaker.name} removed.`
      );

      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove bookmaker"
      );
    }
  }

  // ==================================================
  // SAVE ALL CHANGES
  // ==================================================
  async function saveAllBookmakers() {
    setSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      for (const row of rows) {
        const balance = Number(row.balance);

        if (
          !Number.isFinite(balance) ||
          balance < 0
        ) {
          throw new Error(
            `Invalid balance for ${row.name}`
          );
        }

        // ------------------------------------------
        // EXISTING BOOKMAKER
        // ------------------------------------------
        if (row.id) {
          const existing = bookmakers.find(
            (bookmaker) =>
              bookmaker.id === row.id
          );

          // Don't send PATCH if balance did not change
          if (
            existing &&
            Number(existing.balance) === balance
          ) {
            continue;
          }

          const res = await fetch(
            `${API_URL}/bookmakers/${row.id}`,
            {
              method: "PATCH",
              credentials: "include",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                balance,
              }),
            }
          );

          if (!res.ok) {
            const data =
              await res.json().catch(() => null);

            throw new Error(
              data?.detail ??
                `Unable to update ${row.name}`
            );
          }

          continue;
        }

        // ------------------------------------------
        // NEW BOOKMAKER
        // ------------------------------------------
        //
        // Skip untouched Odds API bookmakers
        // where balance is still zero.
        //
        // A custom bookmaker with a zero balance
        // is also skipped until it gets a value.
        // ------------------------------------------
        if (balance === 0) {
          continue;
        }

        const res = await fetch(
          `${API_URL}/bookmakers`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: row.name,
              balance,
            }),
          }
        );

        if (!res.ok) {
          const data =
            await res.json().catch(() => null);

          throw new Error(
            data?.detail ??
              `Unable to save ${row.name}`
          );
        }
      }

      await loadBookmakers();

      setSavedMessage(
        "Bookmaker balances saved successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save bookmakers"
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // CALCULATIONS
  // ==================================================
  const totalBalance = rows.reduce(
    (sum, row) =>
      sum + (Number(row.balance) || 0),
    0
  );

  const savedCount = rows.filter(
    (row) => !!row.id
  ).length;

  const configuredCount = rows.filter(
    (row) => Number(row.balance) > 0
  ).length;

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-[#F4F7FB] flex">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <Navbar />

        <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            {/* ==================================================
                HEADER
            ================================================== */}
            <div className="mb-8">
              <p className="text-xs font-mono font-bold tracking-widest text-green-600 uppercase">
                Accounts
              </p>

              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                    Bookmakers
                  </h1>

                  <p className="text-sm text-gray-500 mt-2 max-w-2xl">
                    Track your available balances across
                    supported bookmaker accounts.
                  </p>
                </div>
              </div>
            </div>

            {/* ==================================================
                ERROR
            ================================================== */}
            {error && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* ==================================================
                SUCCESS
            ================================================== */}
            {savedMessage && (
              <div className="mb-5 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                ✓ {savedMessage}
              </div>
            )}

            {/* ==================================================
                SUMMARY CARDS
            ================================================== */}
            <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
              {/* TOTAL BALANCE */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-mono font-semibold">
                  Total Balance
                </p>

                <p className="text-2xl font-bold font-mono text-gray-900 mt-2">
                  ${totalBalance.toFixed(2)}
                </p>
              </div>

              {/* SAVED ACCOUNTS */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-mono font-semibold">
                  Saved Accounts
                </p>

                <p className="text-2xl font-bold font-mono text-gray-900 mt-2">
                  {savedCount}
                </p>
              </div>

              {/* ACTIVE BALANCES */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-mono font-semibold">
                  Funded Accounts
                </p>

                <p className="text-2xl font-bold font-mono text-gray-900 mt-2">
                  {configuredCount}
                </p>
              </div>
            </div>

            {/* ==================================================
                ADD BOOKMAKER
            ================================================== */}
            <form
              onSubmit={handleAdd}
              className="
                bg-white
                border
                border-gray-200
                rounded-2xl
                shadow-sm
                p-5
                mb-6
              "
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1">
                  <span className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Add Bookmaker
                  </span>

                  <input
                    type="text"
                    value={newName}
                    onChange={(e) =>
                      setNewName(e.target.value)
                    }
                    placeholder="Enter bookmaker name"
                    className="
                      w-full
                      h-11
                      border
                      border-gray-300
                      rounded-xl
                      px-4
                      text-sm
                      text-gray-900
                      bg-white
                      outline-none
                      transition
                      focus:border-blue-500
                      focus:ring-2
                      focus:ring-blue-500/20
                    "
                  />
                </label>

                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="
                    h-11
                    px-6
                    rounded-xl
                    bg-blue-600
                    hover:bg-blue-700
                    disabled:bg-gray-200
                    disabled:text-gray-400
                    disabled:cursor-not-allowed
                    text-white
                    text-sm
                    font-semibold
                    transition
                    whitespace-nowrap
                  "
                >
                  + Add Bookmaker
                </button>
              </div>

              <p className="text-xs text-gray-400 mt-2">
                Add a bookmaker that is not already in the
                supported list below.
              </p>
            </form>

            {/* ==================================================
                BOOKMAKER LIST
            ================================================== */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* HEADER */}
              <div className="px-5 py-5 sm:px-6 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-blue-50/40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Bookmaker Balances
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    Enter the balance available in each
                    bookmaker account, then save all changes.
                  </p>
                </div>

                <span className="self-start sm:self-auto text-xs font-mono text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                  {rows.length} bookmakers
                </span>
              </div>

              {/* DESKTOP COLUMN HEADERS */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_220px_80px] gap-4 px-6 py-3 bg-white border-b border-gray-100 text-[10px] uppercase tracking-widest font-mono font-semibold text-gray-400">
                <span>Bookmaker</span>

                <span className="text-right">
                  Available Balance
                </span>

                <span className="text-right">
                  Action
                </span>
              </div>

              {/* LOADING */}
              {loading ? (
                <div className="py-16 text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-gray-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Loading bookmakers…
                  </div>
                </div>
              ) : rows.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm font-semibold text-gray-900">
                    No bookmakers available
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    Add a bookmaker above.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {rows.map((bookmaker) => {
                    const balance =
                      Number(bookmaker.balance) || 0;

                    const isSaved =
                      !!bookmaker.id;

                    return (
                      <div
                        key={bookmaker.name}
                        className="
                          grid
                          grid-cols-1
                          sm:grid-cols-[1fr_220px_80px]
                          gap-3
                          sm:gap-4
                          px-5
                          sm:px-6
                          py-4
                          items-center
                          hover:bg-blue-50/40
                          transition
                        "
                      >
                        {/* BOOKMAKER */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="
                              w-11
                              h-11
                              rounded-xl
                              bg-slate-100
                              border
                              border-slate-200
                              flex
                              items-center
                              justify-center
                              text-xs
                              font-bold
                              text-slate-600
                              shrink-0
                            "
                          >
                            {bookmaker.name
                              .split(" ")
                              .filter(Boolean)
                              .map(
                                (word) =>
                                  word[0]
                              )
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {bookmaker.name}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {isSaved ? (
                                <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
                                  Saved
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                                  Not configured
                                </span>
                              )}

                              {balance > 0 && (
                                <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                                  Funded
                                </span>
                              )}

                              {bookmaker.isCustom && (
                                <span className="text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">
                                  Custom
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* BALANCE */}
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1 sm:hidden">
                            Available Balance
                          </p>

                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                              $
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                bookmaker.balance
                              }
                              onChange={(e) =>
                                updateBalance(
                                  bookmaker.name,
                                  e.target.value
                                )
                              }
                              className="
                                w-full
                                h-10
                                border
                                border-gray-300
                                rounded-xl
                                pl-7
                                pr-3
                                text-right
                                text-sm
                                font-mono
                                font-semibold
                                text-gray-900
                                bg-white
                                outline-none
                                transition
                                focus:border-blue-500
                                focus:ring-2
                                focus:ring-blue-500/20
                              "
                            />
                          </div>
                        </div>

                        {/* REMOVE */}
                        <div className="flex justify-end">
                          {bookmaker.isCustom ||
                          bookmaker.id ? (
                            <button
                              type="button"
                              onClick={() =>
                                deleteSavedBookmaker(
                                  bookmaker
                                )
                              }
                              className="
                                text-xs
                                text-gray-400
                                hover:text-red-600
                                transition
                              "
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ==================================================
                  SAVE FOOTER
              ================================================== */}
              <div className="px-5 sm:px-6 py-5 border-t border-gray-200 bg-slate-50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-gray-500">
                    Total available balance
                  </p>

                  <p className="text-xl font-bold font-mono text-gray-900 mt-0.5">
                    ${totalBalance.toFixed(2)}
                  </p>

                  <p className="text-[11px] text-gray-400 mt-1">
                    Changes are not saved until you
                    click Save Changes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={saveAllBookmakers}
                  disabled={saving || loading}
                  className="
                    min-w-[170px]
                    h-11
                    px-6
                    rounded-xl
                    bg-green-600
                    hover:bg-green-700
                    disabled:bg-gray-300
                    disabled:text-gray-500
                    disabled:cursor-not-allowed
                    text-white
                    text-sm
                    font-bold
                    transition
                    shadow-sm
                  "
                >
                  {saving
                    ? "Saving…"
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}