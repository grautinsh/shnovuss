document.addEventListener("DOMContentLoaded", function () {
const { createClient } = supabase;
const supabaseUrl = 'https://byolbufsmyszudjufzkr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5b2xidWZzbXlzenVkanVmemtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzg2Mzc1NzEsImV4cCI6MTk5NDIxMzU3MX0.OlUlM7c2AqwUMoP_zEhMKx0oehAwrouGQbD703N8mPc'
let supabaseClient = createClient(supabaseUrl, supabaseKey);
// Function to calculate new Elo ratings

function calculateElo(rating1, rating2, winner) {
    const k = 40;
    const expectedScore1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
    const expectedScore2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));
    const score1 = winner === "player1" ? 1 : 0;
    const score2 = winner === "player2" ? 1 : 0;

    rating1 += k * (score1 - expectedScore1);
    rating2 += k * (score2 - expectedScore2);

    return [rating1, rating2];
}

// Your Supabase client setup and initialization should be done here
// const supabase = ...


// Function to submit a new game
async function submitGame(e) {
    e.preventDefault();
    // Get form data
    const player1 = document.getElementById("player1").value;
    const player2 = document.getElementById("player2").value;
    const rounds1 = parseInt(document.getElementById("rounds1").value);
    const rounds2 = parseInt(document.getElementById("rounds2").value);

    if (player1 === player2) {
        alert("Please select different players.");
        return;
    }
    // Disable the Submit button and add a delay
    const submitButton = document.getElementById("submit-button");
    const timer = document.getElementById("timer");
    submitButton.disabled = true;
    let remainingTime = 10;

    timer.textContent = ` (${remainingTime}s)`;

    const countdownInterval = setInterval(() => {
        remainingTime--;
        timer.textContent = ` (${remainingTime}s)`;

        if (remainingTime <= 0) {
            clearInterval(countdownInterval);
            timer.textContent = "";
            submitButton.disabled = false;
        }
    }, 1000);
    

    const winner = rounds1 > rounds2 ? "player1" : "player2";

    // Fetch player data
    const { data: playerData1, error: error1 } = await supabaseClient
        .from('players')
        .select('*')
        .eq('name', player1)
        .single();

    const { data: playerData2, error: error2 } = await supabaseClient
        .from('players')
        .select('*')
        .eq('name', player2)
        .single();

    if (error1 || error2) {
        console.error("Error fetching player data:", error1 || error2);
        return;
    }

    // Calculate new ratings
    const [newRating1, newRating2] = calculateElo(playerData1.rating, playerData2.rating, winner);
// Update player data in Supabase
await supabaseClient
.from('players')
.update({
  rating: newRating1,
  games_played: playerData1.games_played + 1,
  games_won: winner === "player1" ? playerData1.games_won + 1 : playerData1.games_won,
  games_lost: winner === "player2" ? playerData1.games_lost + 1 : playerData1.games_lost,
  rounds_won: playerData1.rounds_won + rounds1, // Updated this line
  rounds_lost: playerData1.rounds_lost + rounds2 // Updated this line
})
.eq('name', player1);

await supabaseClient
.from('players')
.update({
  rating: newRating2,
  games_played: playerData2.games_played + 1,
  games_won: winner === "player2" ? playerData2.games_won + 1 : playerData2.games_won,
  games_lost: winner === "player1" ? playerData2.games_lost + 1 : playerData2.games_lost,
  rounds_won: playerData2.rounds_won + rounds2, // Updated this line
  rounds_lost: playerData2.rounds_lost + rounds1 // Updated this line
})
.eq('name', player2);



  // Insert game record into Supabase
  const { data: insertedGame, error: insertError } = await supabaseClient
    .from('games')
    .insert([
        {
            player1: player1,
            player2: player2,
            winner: winner === "player1" ? player1 : player2,
            rounds1: rounds1,
            rounds2: rounds2,
            prev_rating1: playerData1.rating,
            prev_rating2: playerData2.rating
        }
    ]);

  if (insertError) {
    console.error("Error inserting game record:", insertError);
    return;
  }

  console.log("Inserted game record:", insertedGame);

  // Update the recent games list and leaderboard
  updateRecentGames();
  updateLeaderboard();
}

async function populatePlayerDropdowns() {
    console.log("populatePlayerDropdowns called");

    const { data: players, error } = await supabaseClient
        .from('players')
        .select('name')
        .order('name');

    if (error) {
        console.error("Error fetching player names:", error);
        return;
    }

    console.log("Players retrieved:", players);

    const player1Select = document.getElementById("player1");
    const player2Select = document.getElementById("player2");

    players.forEach(player => {
        const option1 = document.createElement("option");
        option1.value = player.name;
        option1.textContent = player.name;
        player1Select.appendChild(option1);

        const option2 = document.createElement("option");
        option2.value = player.name;
        option2.textContent = player.name;
        player2Select.appendChild(option2);
    });
}

// Function to update the recent games list
let currentPage = 1;
const gamesPerPage = 20;

async function updateRecentGames() {
    const { data: totalGames, error: countError } = await supabaseClient
        .from('games')
        .select('id', { count: 'exact' });

    if (countError) {
        console.error("Error counting games:", countError);
        return;
    }

    const totalPages = Math.ceil(totalGames.length / gamesPerPage);

    const { data: recentGames, error } = await supabaseClient
        .from('games')
        .select('*, created_at')
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * gamesPerPage, currentPage * gamesPerPage - 1);

    if (error) {
        console.error("Error fetching recent games:", error);
        return;
    }

    const recentGamesList = document.getElementById("recent-games-list");
    recentGamesList.innerHTML = '';

    recentGames.forEach(game => {
        const listItem = document.createElement("li");
        const gameDate = new Date(game.created_at).toLocaleString();
        listItem.textContent = `${gameDate} - ${game.player1} vs ${game.player2} - Winner: ${game.winner} - Rounds: ${game.rounds1}-${game.rounds2}`;
        recentGamesList.appendChild(listItem);
    });

    document.getElementById("page-info").textContent = `Page ${currentPage}`;

    document.getElementById("prev-page").disabled = currentPage === 1;
    document.getElementById("next-page").disabled = currentPage === totalPages;
}

document.getElementById("prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        updateRecentGames();
    }
});

document.getElementById("next-page").addEventListener("click", async () => {
    const { data: totalGames, error: countError } = await supabaseClient
        .from('games')
        .select('id', { count: 'exact' });

    if (countError) {
        console.error("Error counting games:", countError);
        return;
    }

    const totalPages = Math.ceil(totalGames.length / gamesPerPage);

    if (currentPage < totalPages) {
        currentPage++;
        updateRecentGames();
    }
});


// Function to update the leaderboard
async function updateLeaderboard() {
    const { data: players, error } = await supabaseClient
        .from('players')
        .select('*')
        .order('rating', { ascending: false });

    if (error) {
        console.error("Error fetching leaderboard data:", error);
        return;
    }

    const leaderboardBody = document.getElementById("leaderboard-body");
    leaderboardBody.innerHTML = '';

    players.forEach(player => {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = player.name;
        row.appendChild(nameCell);

        const ratingCell = document.createElement("td");
        ratingCell.textContent = player.rating.toFixed(0);
        row.appendChild(ratingCell);

        const gamesPlayedCell = document.createElement("td");
        gamesPlayedCell.textContent = player.games_played;
        row.appendChild(gamesPlayedCell);

        const gamesWonCell = document.createElement("td");
        gamesWonCell.textContent = player.games_won || 0;
        row.appendChild(gamesWonCell);
    
        const gamesLostCell = document.createElement("td");
        gamesLostCell.textContent = player.games_lost || 0;
        row.appendChild(gamesLostCell);
    
        const roundsWonCell = document.createElement("td");
        roundsWonCell.textContent = player.rounds_won || 0;
        row.appendChild(roundsWonCell);
        

        leaderboardBody.appendChild(row);
    });
}

async function deleteLastGame() {

    if (!confirm("Vai tiešām izdzēst? Atgriezt vairs nevarēs!")) {
        return; // Exit the function if the user clicks "Cancel"
    }

    // Fetch the most recent game
    const { data: lastGame, error: fetchError } = await supabaseClient
        .from('games')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError) {
        console.error("Error fetching the last game:", fetchError);
        return;
    }

    if (!lastGame) {
        console.log("No games found to delete");
        return;
    }

    // Fetch player data
    const { data: playerData1, error: error1 } = await supabaseClient
        .from('players')
        .select('*')
        .eq('name', lastGame.player1)
        .single();

    const { data: playerData2, error: error2 } = await supabaseClient
        .from('players')
        .select('*')
        .eq('name', lastGame.player2)
        .single();

    if (error1 || error2) {
        console.error("Error fetching player data:", error1 || error2);
        return;
    }

  // Revert player statistics
  await supabaseClient
    .from('players')
    .update({
      rating: lastGame.prev_rating1,
      games_played: playerData1.games_played - 1,
      games_won: lastGame.winner === playerData1.name ? playerData1.games_won - 1 : playerData1.games_won,
      games_lost: lastGame.winner !== playerData1.name ? playerData1.games_lost - 1 : playerData1.games_lost,
      rounds_won: playerData1.rounds_won - lastGame.rounds1,
      rounds_lost: playerData1.rounds_lost - lastGame.rounds2,
    })
    .eq('name', lastGame.player1);

  await supabaseClient
    .from('players')
    .update({
      rating: lastGame.prev_rating2,
      games_played: playerData2.games_played - 1,
      games_won: lastGame.winner === playerData2.name ? playerData2.games_won - 1 : playerData2.games_won,
      games_lost: lastGame.winner !== playerData2.name ? playerData2.games_lost - 1 : playerData2.games_lost,
      rounds_won: playerData2.rounds_won - lastGame.rounds2,
      rounds_lost: playerData2.rounds_lost - lastGame.rounds1,
    })
    .eq('name', lastGame.player2);

        // Delete the last game from the 'games' table
    const { data: deletedGame, error: deleteError } = await supabaseClient
    .from('games')
    .delete()
    .eq('id', lastGame.id);

if (deleteError) {
    console.error("Error deleting the last game:", deleteError);
    return;
}

console.log("Deleted game record:", deletedGame);

    // Update the recent games list and leaderboard
    updateRecentGames();
    updateLeaderboard();
}


// Add event listener for the form submission
document.getElementById("game-form").addEventListener("submit", submitGame);
document.getElementById("delete-last-game").addEventListener("click", deleteLastGame);


// Initialize the recent games list and leaderboard
(async () => {
    await populatePlayerDropdowns();
    updateRecentGames();
    updateLeaderboard();
  })();

});
