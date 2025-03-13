import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

// Game constants
const GRID_SIZE = 20;
const CELL_SIZE = Math.floor(Dimensions.get("window").width / GRID_SIZE);
const GRID_WIDTH = Math.floor(Dimensions.get("window").width / CELL_SIZE);
const GRID_HEIGHT = Math.floor(
  (Dimensions.get("window").height * 0.8) / CELL_SIZE
);

// Colors
const COLORS = {
  RED: "#FF0000",
  ORANGE: "#FFA500",
  YELLOW: "#FFFF00",
  GREEN: "#00FF00",
  BLUE: "#0000FF",
  GREY: "#808080",
  BLACK: "#000000",
};

// Directions
const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

// Initial game state
const initialState = {
  snake: [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 3, y: 5 },
  ],
  food: { x: 10, y: 10, color: COLORS.RED },
  direction: "RIGHT",
  speed: 200,
  score: 0,
  gameOver: false,
  snakeColor: COLORS.RED,
  showRules: true,
  isPractice: true,
  practiceAttemptsLeft: 3,
  realAttemptsLeft: 3,
  realScores: [0, 0, 0],
  currentAttemptNumber: 0, // For real game, this will be updated via resetGame.
};

// Type definition for obstacles
type Obstacle = {
  x: number;
  y: number;
};

// Get a random position on the grid
const getRandomPosition = () => ({
  x: Math.floor(Math.random() * GRID_WIDTH),
  y: Math.floor(Math.random() * GRID_HEIGHT),
});

// Generate obstacles (a few 2x2 blocks)
const generateObstacles = (): Obstacle[] => {
  const obstacles: Obstacle[] = [];
  const patternLocations = [
    {
      startX: Math.floor(GRID_WIDTH * 0.25),
      startY: Math.floor(GRID_HEIGHT * 0.25),
    },
    {
      startX: Math.floor(GRID_WIDTH * 0.75),
      startY: Math.floor(GRID_HEIGHT * 0.25),
    },
    {
      startX: Math.floor(GRID_WIDTH * 0.5),
      startY: Math.floor(GRID_HEIGHT * 0.75),
    },
  ];

  patternLocations.forEach((location) => {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        obstacles.push({
          x: location.startX + i,
          y: location.startY + j,
        });
      }
    }
  });
  return obstacles;
};

// ScoreTracker class to keep score reliably
class ScoreTracker {
  private scores: number[];
  private currentScore: number;
  private currentAttempt: number;
  private foodEatenCount: number;

  constructor() {
    this.scores = [0, 0, 0];
    this.currentScore = 0;
    this.currentAttempt = 0;
    this.foodEatenCount = 0;
  }

  // Track food eaten (for potential speed calculations)
  incrementFoodEaten() {
    this.foodEatenCount++;
    return this.foodEatenCount;
  }

  // Increment score by a given number of points
  incrementScore(points: number) {
    this.currentScore += points;
    console.log(
      `SCORE DEBUG: Food eaten: ${this.foodEatenCount}, Score: ${this.currentScore}`
    );
    return this.currentScore;
  }

  getCurrentScore() {
    return this.currentScore;
  }

  startNewAttempt(attemptNumber: number, previousScores?: number[]) {
    if (previousScores && previousScores.length === 3) {
      this.scores = [...previousScores];
      console.log("Starting new attempt with preserved scores:", this.scores);
    }
    this.currentAttempt = attemptNumber;
    this.currentScore = 0;
    this.foodEatenCount = 0;
  }

  finalizeAttempt() {
    // If currentAttempt is 0 (i.e. first attempt), treat it as attempt 1.
    if (this.currentAttempt <= 0) {
      this.currentAttempt = 1;
    }
    if (this.currentAttempt > 0 && this.currentAttempt <= 3) {
      // Ensure we record the score for the current attempt.
      if (this.currentScore > 0 || this.scores[this.currentAttempt - 1] === 0) {
        this.scores[this.currentAttempt - 1] = this.currentScore;
      }
    }
    return {
      scores: [...this.scores],
      currentScore: this.currentScore,
    };
  }

  getAllScores() {
    return [...this.scores];
  }

  reset() {
    this.scores = [0, 0, 0];
    this.currentScore = 0;
    this.currentAttempt = 0;
    this.foodEatenCount = 0;
  }

  getFoodEatenCount() {
    return this.foodEatenCount;
  }
}

// Helper function to calculate points when food is eaten
function calculatePointsForFood(
  food: { x: number; y: number; color: string },
  snakeLength: number
) {
  // For simplicity, each food gives 10 points.
  return 10;
}

export default function Game() {
  const [gameState, setGameState] = useState({ ...initialState });
  const [highScore, setHighScore] = useState(0);
  const [obstacles] = useState(generateObstacles());
  const gameLoopInterval = useRef<NodeJS.Timeout | null>(null);
  const scoreTracker = useRef(new ScoreTracker());
  const latestScores = useRef<number[]>([0, 0, 0]);

  // Load high score on mount
  useEffect(() => {
    loadHighScore();
  }, []);

  const loadHighScore = async () => {
    try {
      const savedScore = await AsyncStorage.getItem("highScore");
      if (savedScore) setHighScore(parseInt(savedScore));
    } catch (error) {
      console.error("Error loading high score:", error);
    }
  };

  const saveHighScore = async (score: number) => {
    try {
      if (score > highScore) {
        await AsyncStorage.setItem("highScore", score.toString());
        setHighScore(score);
      }
    } catch (error) {
      console.error("Error saving high score:", error);
    }
  };

  // Main game loop: move the snake and handle food consumption
  const moveSnake = () => {
    setGameState((prevState) => {
      const newSnake = [...prevState.snake];
      const head = { ...newSnake[0] };
      const direction =
        DIRECTIONS[prevState.direction as keyof typeof DIRECTIONS];

      head.x += direction.x;
      head.y += direction.y;

      // Wrap the snake around the grid edges
      head.x = (head.x + GRID_WIDTH) % GRID_WIDTH;
      head.y = (head.y + GRID_HEIGHT) % GRID_HEIGHT;

      // Check collision with obstacles or self
      if (
        obstacles.some((obs) => obs.x === head.x && obs.y === head.y) ||
        newSnake.some((segment) => segment.x === head.x && segment.y === head.y)
      ) {
        handleGameOver();
        return prevState;
      }

      newSnake.unshift(head);

      // If food is eaten, update score using the ref and adjust speed
      if (head.x === prevState.food.x && head.y === prevState.food.y) {
        const pointsEarned = calculatePointsForFood(
          prevState.food,
          newSnake.length
        );
        scoreTracker.current.incrementScore(pointsEarned);

        // Calculate new speed (with a cap)
        const newSpeed = Math.max(
          80,
          prevState.speed -
            Math.min(60, Math.floor(7 * Math.log(newSnake.length + 1)))
        );

        return {
          ...prevState,
          snake: newSnake,
          snakeColor: prevState.food.color,
          food: {
            ...getRandomPosition(),
            color: Object.values(COLORS).filter(
              (c) => c !== COLORS.GREY && c !== COLORS.BLACK
            )[Math.floor(Math.random() * 5)],
          },
          speed: newSpeed,
          score: scoreTracker.current.getCurrentScore(), // update UI display
        };
      } else {
        newSnake.pop();
        return {
          ...prevState,
          snake: newSnake,
        };
      }
    });
  };

  // Set up the game loop using a ref-managed interval.
  useEffect(() => {
    if (gameLoopInterval.current) {
      clearInterval(gameLoopInterval.current);
    }
    if (!gameState.gameOver) {
      gameLoopInterval.current = setInterval(moveSnake, gameState.speed);
    }
    return () => {
      if (gameLoopInterval.current) {
        clearInterval(gameLoopInterval.current);
      }
    };
  }, [gameState.speed, gameState.gameOver]);

  // Handle game over: clear the interval and send final score using the ref value.
  const handleGameOver = () => {
    if (gameLoopInterval.current) {
      clearInterval(gameLoopInterval.current);
    }
    const finalScore = scoreTracker.current.getCurrentScore();

    // Finalize this attempt and update our scores array.
    scoreTracker.current.finalizeAttempt();
    latestScores.current = scoreTracker.current.getAllScores();

    setGameState((prev) => ({
      ...prev,
      gameOver: true,
      score: finalScore,
      realScores: latestScores.current,
    }));

    // Decouple score sending from game speed using setTimeout
    setTimeout(() => {
      if (typeof window !== "undefined" && window.ReactNativeWebView) {
        // Send the current attempt's score
        const scoreUpdate = {
          type: "attemptScore",
          attemptNumber: gameState.currentAttemptNumber,
          score: finalScore,
          attemptsLeft: gameState.realAttemptsLeft - 1,
          allScores: latestScores.current,
          isHighScore: finalScore > highScore,
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(scoreUpdate));
        console.log("Attempt score update sent:", scoreUpdate);

        // After the final real attempt, send comprehensive score data.
        if (!gameState.isPractice && gameState.realAttemptsLeft <= 1) {
          const highestScore = Math.max(
            ...latestScores.current.filter(
              (score) => typeof score === "number" && !isNaN(score)
            )
          );

          const finalScoreData = {
            type: "finalScores",
            scores: latestScores.current,
            attemptScores: {
              attempt1: latestScores.current[0] || 0,
              attempt2: latestScores.current[1] || 0,
              attempt3: latestScores.current[2] || 0,
            },
            allHighScores: {
              sessionHighScore: highestScore,
              overallHighScore: highScore,
            },
            isComplete: true,
          };
          window.ReactNativeWebView.postMessage(JSON.stringify(finalScoreData));
          console.log("Final scores sent:", finalScoreData);

          // Optionally update the overall high score
          if (highestScore > highScore) {
            saveHighScore(highestScore);
          }
        }
      } else {
        console.warn("ReactNativeWebView not available");
      }
    }, 100); // Short delay to ensure game state is fully updated
  };

  // Handle gesture-based direction changes.
  const handleGesture = (direction: string) => {
    const opposites = {
      UP: "DOWN",
      DOWN: "UP",
      LEFT: "RIGHT",
      RIGHT: "LEFT",
    };

    setGameState((prevState) => {
      if (
        prevState.direction === opposites[direction as keyof typeof opposites]
      ) {
        return prevState;
      }
      return { ...prevState, direction };
    });
  };

  const startGame = () => {
    setGameState((prev) => ({ ...prev, showRules: false }));
  };

  const resetGame = () => {
    setGameState((prev) => {
      if (prev.isPractice && prev.practiceAttemptsLeft <= 1) {
        // Transition from practice to real game:
        scoreTracker.current.reset();
        latestScores.current = [0, 0, 0];
        return {
          ...initialState,
          showRules: false,
          isPractice: false,
          practiceAttemptsLeft: 0,
          realAttemptsLeft: 3,
          realScores: [0, 0, 0],
          currentAttemptNumber: 1,
        };
      }
      if (!prev.isPractice && prev.realAttemptsLeft <= 1) {
        // Game completely over
        scoreTracker.current.reset();
        latestScores.current = [0, 0, 0];
        return { ...initialState };
      }
      if (!prev.isPractice) {
        // Next real attempt: update attempt number and start new attempt in the score tracker.
        const nextAttemptNumber = prev.currentAttemptNumber + 1;
        scoreTracker.current.startNewAttempt(
          nextAttemptNumber,
          latestScores.current
        );
        return {
          ...initialState,
          showRules: false,
          isPractice: false,
          practiceAttemptsLeft: 0,
          realAttemptsLeft: prev.realAttemptsLeft - 1,
          realScores: latestScores.current,
          currentAttemptNumber: nextAttemptNumber,
        };
      }
      // For practice mode, simply decrement practiceAttemptsLeft.
      return {
        ...initialState,
        showRules: false,
        isPractice: true,
        practiceAttemptsLeft: prev.practiceAttemptsLeft - 1,
        realAttemptsLeft: 3,
        realScores: [0, 0, 0],
        currentAttemptNumber: 0,
      };
    });
  };

  // Swipe gesture handling (only allowing 90-degree turns)
  const swipeGesture = Gesture.Pan().onEnd((event) => {
    const { translationX, translationY } = event;
    if (Math.abs(translationX) > Math.abs(translationY) * 2) {
      if (gameState.direction === "UP" || gameState.direction === "DOWN") {
        handleGesture(translationX > 0 ? "RIGHT" : "LEFT");
      }
    } else if (Math.abs(translationY) > Math.abs(translationX) * 2) {
      if (gameState.direction === "LEFT" || gameState.direction === "RIGHT") {
        handleGesture(translationY > 0 ? "DOWN" : "UP");
      }
    }
  });

  // Rules screen component
  const RulesScreen = () => (
    <View style={styles.rulesScreen}>
      <Text style={styles.rulesTitle}>CHROMA{"\n"}SNAKE</Text>
      <Text style={styles.snakeArt}>
        {"    ┌──┐     \n"}
        {"    │··│     \n"}
        {"    └┐ │     \n"}
        {"     │ │     \n"}
        {"     │ └┐    \n"}
        {"     └─ ┘    \n"}
      </Text>
      <View style={styles.rulesContainer}>
        <Text style={styles.rulesText}>EAT FRUIT, SPEED UP!</Text>
        <Text style={styles.rulesText}>AVOID BLOCKS</Text>
        <Text style={styles.rulesText}>PRACTICE × 3</Text>
        <Text style={styles.rulesText}>REAL GAME × 3</Text>
      </View>
      <TouchableOpacity style={styles.playButton} onPress={startGame}>
        <Text style={styles.playButtonText}>PLAY!</Text>
      </TouchableOpacity>
    </View>
  );

  // Display current attempt info
  const AttemptsDisplay = () => {
    const attemptNumber = gameState.isPractice
      ? Math.max(1, 4 - gameState.practiceAttemptsLeft)
      : Math.max(1, 4 - gameState.realAttemptsLeft);
    return (
      <View style={styles.attemptsContainer}>
        <Text
          style={[
            styles.attemptsText,
            { color: gameState.isPractice ? COLORS.GREEN : COLORS.RED },
          ]}
        >
          {`${gameState.isPractice ? "PRACTICE" : "REAL"} ${attemptNumber}/3`}
        </Text>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {gameState.showRules ? (
        <RulesScreen />
      ) : (
        <>
          <View style={styles.headerContainer}>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>SCORE: {gameState.score}</Text>
              <AttemptsDisplay />
            </View>
          </View>
          <GestureDetector gesture={swipeGesture}>
            <View
              style={[styles.gameBoard, { borderColor: gameState.snakeColor }]}
            >
              {gameState.snake.map((segment, index) => (
                <View
                  key={index}
                  style={[
                    styles.cell,
                    {
                      left: segment.x * CELL_SIZE,
                      top: segment.y * CELL_SIZE,
                      backgroundColor: gameState.snakeColor,
                    },
                  ]}
                />
              ))}
              <View
                style={[
                  styles.cell,
                  {
                    left: gameState.food.x * CELL_SIZE,
                    top: gameState.food.y * CELL_SIZE,
                    backgroundColor: gameState.food.color,
                  },
                ]}
              />
              {obstacles.map((obstacle, index) => (
                <View
                  key={`obstacle-${index}`}
                  style={[
                    styles.cell,
                    {
                      left: obstacle.x * CELL_SIZE,
                      top: obstacle.y * CELL_SIZE,
                      backgroundColor: COLORS.GREY,
                    },
                  ]}
                />
              ))}
            </View>
          </GestureDetector>
          {gameState.gameOver && (
            <View style={styles.gameOver}>
              <Text style={styles.gameOverText}>Game Over!</Text>
              <Text style={styles.scoreText}>Score: {gameState.score}</Text>
              <Text
                style={[
                  styles.attemptsText,
                  { color: gameState.isPractice ? COLORS.GREEN : COLORS.RED },
                ]}
              >
                {gameState.isPractice
                  ? `Practice ${Math.max(
                      1,
                      4 - gameState.practiceAttemptsLeft
                    )}/3`
                  : `Real ${Math.max(1, 4 - gameState.realAttemptsLeft)}/3`}
              </Text>
              {!gameState.isPractice && gameState.realAttemptsLeft <= 1 ? (
                <TouchableOpacity
                  style={[
                    styles.replayButton,
                    { backgroundColor: COLORS.BLUE },
                  ]}
                  onPress={resetGame}
                >
                  <Text style={[styles.replayText, { color: COLORS.BLACK }]}>
                    LEADERBOARD
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.replayButton}
                  onPress={resetGame}
                >
                  <Text style={styles.replayText}>
                    {gameState.isPractice && gameState.practiceAttemptsLeft <= 1
                      ? "Start Real Game"
                      : "Try Again"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BLACK,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContainer: {
    width: "100%",
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 2,
  },
  scoreContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  scoreText: {
    color: COLORS.ORANGE,
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  gameBoard: {
    width: GRID_WIDTH * CELL_SIZE,
    height: GRID_HEIGHT * CELL_SIZE,
    borderWidth: 4,
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderStyle: "solid",
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  gameOver: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.95)",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  gameOverText: {
    color: COLORS.RED,
    fontSize: 48,
    fontWeight: "bold",
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 4,
    textShadowColor: "rgba(255, 0, 0, 0.75)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 1,
    marginBottom: 20,
  },
  replayButton: {
    backgroundColor: COLORS.ORANGE,
    padding: 15,
    borderRadius: 0,
    marginTop: 20,
    borderWidth: 4,
    borderColor: "#FFC04D",
    borderBottomColor: "#CC8400",
    borderRightColor: "#CC8400",
    minWidth: 200,
    alignItems: "center",
  },
  replayText: {
    color: COLORS.BLACK,
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  rulesScreen: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: COLORS.BLACK,
    padding: 15,
    paddingTop: "10%",
  },
  rulesTitle: {
    color: COLORS.RED,
    fontSize: 48,
    fontWeight: "bold",
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 4,
    textShadowColor: "rgba(255, 0, 0, 0.75)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 1,
    marginBottom: 15,
    textAlign: "center",
  },
  snakeArt: {
    color: COLORS.GREEN,
    fontSize: 20,
    fontFamily: "monospace",
    marginBottom: 20,
    textAlign: "center",
    textShadowColor: "rgba(0, 255, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  rulesContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    width: "100%",
    paddingHorizontal: 20,
  },
  rulesText: {
    color: COLORS.ORANGE,
    fontSize: 24,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 15,
    textShadowColor: "rgba(255, 165, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    textAlign: "center",
    width: "100%",
  },
  playButton: {
    backgroundColor: COLORS.GREEN,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 0,
    borderWidth: 4,
    borderColor: "#00FF00",
    borderBottomColor: "#008000",
    borderRightColor: "#008000",
  },
  playButtonText: {
    color: COLORS.BLACK,
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  attemptsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  attemptsText: {
    color: COLORS.ORANGE,
    fontSize: 16,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "bold",
  },
});
