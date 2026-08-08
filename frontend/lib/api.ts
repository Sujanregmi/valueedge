const API_URL = "http://127.0.0.1:8000";


// Dashboard bankroll
export async function getBankroll(userId: number) {

    const response = await fetch(
        `${API_URL}/bankroll/${userId}`
    );

    return response.json();
}


// My Bets
export async function getBets(userId: number) {

    const response = await fetch(
        `${API_URL}/bets/${userId}`
    );

    return response.json();
}


// Bookmakers
export async function getBookmakers(userId: number) {

    const response = await fetch(
        `${API_URL}/bookmakers/${userId}`
    );

    return response.json();
}


// Value Bets Scanner
export async function getValueBets(){

    const response = await fetch(
        `${API_URL}/value-bets/`
    );

    const data = await response.json();

    console.log("VALUE BET API DATA:", data);

    return data;

}