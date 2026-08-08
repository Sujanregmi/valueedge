"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";


export default function LoginPage() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");


  async function handleLogin(e: React.FormEvent) {

    e.preventDefault();


    const response = await fetch(
      "http://localhost:8000/login",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email,
          password,
        }),
      }
    );


    const data = await response.json();


    if (response.ok) {

      localStorage.setItem(
        "token",
        data.access_token
      );


      alert("Login successful!");

      router.push("/dashboard");

    } 
    
    else {

      alert(data.detail);

    }

  }


  return (

    <main className="min-h-screen flex items-center justify-center bg-slate-100">

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">

        <h1 className="text-3xl font-bold text-center text-green-600 mb-6">
          EdgePulse
        </h1>


        <p className="text-center text-gray-500 mb-6">
          Login to your account
        </p>


        <form 
          onSubmit={handleLogin}
          className="space-y-4"
        >

          <input
            className="w-full border rounded-lg p-3"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
          />


          <input
            className="w-full border rounded-lg p-3"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
          />


          <button
            type="submit"
            className="w-full bg-green-600 text-white p-3 rounded-lg"
          >
            Login
          </button>


        </form>

      </div>

    </main>

  );
}