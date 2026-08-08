"use client";

import { useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";


export default function RegisterPage() {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");


  async function handleRegister(e: React.FormEvent) {

    e.preventDefault();


    const response = await fetch(
      "http://localhost:8000/register",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name,
          email,
          password,
        }),
      }
    );


    const data = await response.json();


    if (response.ok) {
      alert("Account created successfully!");
      console.log(data);
    }

    else {
      alert(data.detail);
    }

  }


  return (

    <main className="min-h-screen flex items-center justify-center bg-slate-100">

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">


        <div className="text-center mb-8">

          <h1 className="text-4xl font-bold text-green-600">
            EdgePulse
          </h1>

          <p className="text-gray-500 mt-2">
            Create your account
          </p>

        </div>


        <form 
          onSubmit={handleRegister}
          className="space-y-5"
        >

          <input
            className="w-full border rounded-lg p-3"
            placeholder="Full Name"
            value={name}
            onChange={(e)=>setName(e.target.value)}
          />


          <input
            className="w-full border rounded-lg p-3"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
          />


          <input
            className="w-full border rounded-lg p-3"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
          />


          <Button type="submit">
            Create Account
          </Button>


        </form>


      </div>

    </main>

  );
}