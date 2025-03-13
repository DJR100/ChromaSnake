import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// Game constants
const GRID_SIZE = 20;
const CELL_SIZE = Math.floor(Dimensions.get('window').width / GRID_SIZE);
const GRID_WIDTH = Math.floor(Dimensions.get('window').width / CELL_SIZE);
const GRID_HEIGHT = Math.floor((Dimensions.get('window').height * 0.8) / CELL_SIZE);

// Colors
const COLORS = {
  RED: '#FF0000',
  ORANGE: '#FFA500',
  YELLOW: '#FFFF00',
  GREEN: '#00FF00',
  BLUE: '#0000FF',
  GREY: '#808080',
  BLACK: '#000000',
};

// Add these direction constants
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
    { x: 3, y: 5 }
  ],
  food: { x: 10, y: 10, color: COLORS.RED },
  direction: 'RIGHT',
  speed: 200,
  score: 0,
  gameOver: false,
  snakeColor: COLORS.RED,
  showRules: true,
  isPractice: true,
  practiceAttemptsLeft: 3,
  realAttemptsLeft: 3,
  realScores: [0, 0, 0] as number[], // Initialize with zeros
  currentAttemptNumber: 0,
};

// Add type definition for obstacles
type Obstacle = {
  x: number;
  y: number;
};

// Generate random position
const getRandomPosition = () => ({
  x: Math.floor(Math.random() * GRID_WIDTH),
  y: Math.floor(Math.random() * GRID_HEIGHT),
});

// Generate obstacles
const generateObstacles = (): Obstacle[] => {
  const obstacles: Obstacle[] = [];
  
  // Create a 2x2 pattern of obstacles in three locations
  const patternLocations = [
    { startX: Math.floor(GRID_WIDTH * 0.25), startY: Math.floor(GRID_HEIGHT * 0.25) },
    { startX: Math.floor(GRID_WIDTH * 0.75), startY: Math.floor(GRID_HEIGHT * 0.25) },
    { startX: Math.floor(GRID_WIDTH * 0.5), startY: Math.floor(GRID_HEIGHT * 0.75) }
  ];

  patternLocations.forEach(location => {
    // Create a 2x2 block of obstacles
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        obstacles.push({
          x: location.startX + i,
          y: location.startY + j
        });
      }
    }
  });

  return obstacles;
};

// Alternative pattern option (uncomment to try different pattern):
/*
const generateObstacles = () => {
  const obstacles = [];
  
  // Create a cross pattern in the middle of the board
  const centerX = Math.floor(GRID_WIDTH * 0.5);
  const centerY = Math.floor(GRID_HEIGHT * 0.5);
  
  // Horizontal line
  for (let i = -1; i <= 1; i++) {
    obstacles.push({ x: centerX + i, y: centerY });
  }
  
  // Vertical line
  for (let i = -1; i <= 1; i++) {
    if (i !== 0) { // Skip center as it's already added
      obstacles.push({ x: centerX, y: centerY + i });
    }
  }

  return obstacles;
};
*/

// Add pixel art effect styles
const pixelArtEffect = {
  textShadow: '2px 2px #000',
  fontFamily: 'monospace', // Fallback until we add custom font
  textTransform: 'uppercase' as const,
  letterSpacing: 2,
};

// Add ScoreTracker class before the Game component
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

  incrementScore() {
    this.foodEatenCount++;
    this.currentScore = this.foodEatenCount;
    return this.currentScore;
  }

  getCurrentScore() {
    return this.currentScore;
  }

  startNewAttempt(attemptNumber: number) {
    this.currentAttempt = attemptNumber;
    this.currentScore = 0;
    this.foodEatenCount = 0;
  }

  finalizeAttempt() {
    // Store the score in the appropriate array position
    if (this.currentAttempt > 0 && this.currentAttempt <= 3) {
      this.scores[this.currentAttempt - 1] = this.currentScore;
    }
    
    // Return both the scores array and the current score
    // This ensures we have access to the current score even after finalization
    return {
      scores: [...this.scores],
      currentScore: this.currentScore
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
}

export default function Game() {
  const [gameState, setGameState] = useState({ ...initialState });
  const [highScore, setHighScore] = useState(0);
  const [obstacles] = useState(generateObstacles());
  const gameLoop = useRef<NodeJS.Timeout>();
  const scoreTracker = useRef(new ScoreTracker());

  // Load high score on mount
  useEffect(() => {
    loadHighScore();
  }, []);

  const loadHighScore = async () => {
    try {
      const savedScore = await AsyncStorage.getItem('highScore');
      if (savedScore) setHighScore(parseInt(savedScore));
    } catch (error) {
      console.error('Error loading high score:', error);
    }
  };

  const saveHighScore = async (score: number) => {
    try {
      // Only save to AsyncStorage if it's a new high score
      if (score > highScore) {
        await AsyncStorage.setItem('highScore', score.toString());
        setHighScore(score);
      }
    } catch (error) {
      console.error('Error saving high score:', error);
    }
  };

  const moveSnake = () => {
    setGameState(prevState => {
      const newSnake = [...prevState.snake];
      const head = { ...newSnake[0] };
      const direction = DIRECTIONS[prevState.direction as keyof typeof DIRECTIONS];

      head.x += direction.x;
      head.y += direction.y;

      if (head.x < 0) head.x = GRID_WIDTH - 1;
      if (head.x >= GRID_WIDTH) head.x = 0;
      if (head.y < 0) head.y = GRID_HEIGHT - 1;
      if (head.y >= GRID_HEIGHT) head.y = 0;

      if (
        obstacles.some(obs => obs.x === head.x && obs.y === head.y) ||
        newSnake.some(segment => segment.x === head.x && segment.y === head.y)
      ) {
        handleGameOver();
        return prevState;
      }

      newSnake.unshift(head);

      if (head.x === prevState.food.x && head.y === prevState.food.y) {
        const newScore = !prevState.isPractice ? scoreTracker.current.incrementScore() : prevState.score + 1;
        
        console.log('=== SCORE UPDATE DEBUG ===');
        console.log('Food eaten:', {
          newScore,
          trackerScore: scoreTracker.current.getCurrentScore(),
          isPractice: prevState.isPractice,
          currentAttempt: prevState.currentAttemptNumber,
          allScores: scoreTracker.current.getAllScores()
        });
        
        // Calculate speed reduction based on score threshold
        const speedReduction = newScore <= 10 
          ? Math.floor(newScore / 5) * 20
          : (2 * 20) + Math.floor((newScore - 10) / 5) * 8;
        const newSpeed = Math.max(50, prevState.speed - speedReduction);
        
        const newState = {
          ...prevState,
          snake: newSnake,
          score: newScore,
          speed: newSpeed,
          snakeColor: prevState.food.color,
          food: {
            ...getRandomPosition(),
            color: Object.values(COLORS).filter(c => c !== COLORS.GREY && c !== COLORS.BLACK)[
              Math.floor(Math.random() * 5)
            ],
          },
        };
        
        return newState;
      } else {
        newSnake.pop();
        return {
          ...prevState,
          snake: newSnake,
        };
      }
    });
  };

  useEffect(() => {
    if (!gameState.gameOver) {
      const interval = setInterval(moveSnake, gameState.speed);
      return () => clearInterval(interval);
    }
  }, [gameState.speed, gameState.gameOver]);

  const handleGameOver = () => {
    if (gameLoop.current) clearInterval(gameLoop.current);
    
    if (!gameState.isPractice) {
      try {
        // IMPORTANT: Capture all scores BEFORE any operations that might reset them
        const currentAttemptNumber = 3 - (gameState.realAttemptsLeft - 1);
        const gameStateScore = gameState.score;
        const trackerScore = scoreTracker.current.getCurrentScore();
        
        // Use the game state score as our source of truth
        const scoreToSend = gameStateScore;
        
        // Create a copy of the current scores before finalizing
        const currentScores = [...scoreTracker.current.getAllScores()];
        
        // Manually update the scores array with our score
        if (currentAttemptNumber > 0 && currentAttemptNumber <= 3) {
          currentScores[currentAttemptNumber - 1] = scoreToSend;
        }
        
        // Now finalize the attempt (this might reset internal state)
        const finalScores = scoreTracker.current.finalizeAttempt();
        
        // Use our manually updated scores to ensure correctness
        const scoresToUse = currentScores;
        
        console.log('=== GAME OVER DEBUG ===');
        console.log('Current State:', {
          currentAttemptNumber,
          realAttemptsLeft: gameState.realAttemptsLeft,
          gameStateScore,
          trackerScore,
          scoreToSend,
          currentScores,
          finalScores,
          scoresToUse
        });

        // Send intermediate score update
        if (typeof window !== 'undefined' && window.ReactNativeWebView) {
          const scoreUpdate = {
            type: 'attemptScore',
            attemptNumber: currentAttemptNumber,
            score: scoreToSend, // Use the game state score
            attemptsLeft: gameState.realAttemptsLeft - 1,
            allScores: scoresToUse, // Use our manually updated scores
            isHighScore: scoreToSend > highScore
          };
          console.log('Sending to React Native:', scoreUpdate);
          window.ReactNativeWebView.postMessage(JSON.stringify(scoreUpdate));
          
          // Verify the message was sent
          console.log('Score update sent successfully');
        } else {
          console.warn('ReactNativeWebView not available for score update');
        }

        // If this was the final attempt, send all scores
        if (gameState.realAttemptsLeft <= 1) {
          if (typeof window !== 'undefined' && window.ReactNativeWebView) {
            const allScores = finalScores.scores;
            const highestScore = Math.max(...allScores.filter(score => !isNaN(score) && score !== null));
            
            const finalScoreData = {
              type: 'finalScores',
              scores: allScores,
              isComplete: true,
              highestScore,
              attemptScores: {
                attempt1: allScores[0] || 0,
                attempt2: allScores[1] || 0,
                attempt3: allScores[2] || 0
              },
              allHighScores: {
                sessionHighScore: highestScore,
                overallHighScore: highScore
              }
            };
            console.log('Sending final scores to React Native:', finalScoreData);
            window.ReactNativeWebView.postMessage(JSON.stringify(finalScoreData));
            console.log('Final scores sent successfully');
          } else {
            console.warn('ReactNativeWebView not available for final scores');
          }
        }

        // Log state before update
        console.log('Setting game state with scores:', finalScores.scores);
        
        setGameState(prev => ({
          ...prev,
          gameOver: true,
          realScores: finalScores.scores
        }));

        console.log('=== END GAME OVER DEBUG ===');
      } catch (error) {
        console.error('Error in handleGameOver:', error);
        setGameState(prev => ({ ...prev, gameOver: true }));
      }
    } else {
      setGameState(prev => ({ ...prev, gameOver: true }));
    }
  };

  const handleGesture = (direction: string) => {
    const opposites = {
      UP: 'DOWN',
      DOWN: 'UP',
      LEFT: 'RIGHT',
      RIGHT: 'LEFT',
    };
    
    setGameState(prevState => {
      // Prevent moving in opposite direction
      if (prevState.direction === opposites[direction as keyof typeof opposites]) {
        return prevState;
      }
      return { ...prevState, direction };
    });
  };

  const startGame = () => {
    setGameState(prev => ({ ...prev, showRules: false }));
  };

  const resetGame = () => {
    setGameState(prev => {
      if (prev.isPractice && prev.practiceAttemptsLeft <= 1) {
        scoreTracker.current.reset();
        return {
          ...initialState,
          showRules: false,
          isPractice: false,
          practiceAttemptsLeft: 0,
          realAttemptsLeft: 3,
          realScores: [0, 0, 0],
          currentAttemptNumber: 1
        };
      }
      
      if (!prev.isPractice && prev.realAttemptsLeft <= 1) {
        scoreTracker.current.reset();
        return { ...initialState };
      }

      if (!prev.isPractice) {
        const nextAttemptNumber = prev.currentAttemptNumber + 1;
        scoreTracker.current.startNewAttempt(nextAttemptNumber);
        return {
          ...initialState,
          showRules: false,
          isPractice: false,
          practiceAttemptsLeft: 0,
          realAttemptsLeft: prev.realAttemptsLeft - 1,
          realScores: scoreTracker.current.getAllScores(),
          currentAttemptNumber: nextAttemptNumber
        };
      }

      return {
        ...initialState,
        showRules: false,
        isPractice: true,
        practiceAttemptsLeft: prev.practiceAttemptsLeft - 1,
        realAttemptsLeft: 3,
        realScores: [0, 0, 0],
        currentAttemptNumber: 0
      };
    });
  };

  // Modify the swipe gesture to only allow 90-degree turns
  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      const { translationX, translationY } = event;
      
      // Only allow turning if the swipe is significantly in one direction
      if (Math.abs(translationX) > Math.abs(translationY) * 2) {
        // Horizontal swipe - only allow if currently moving vertically
        if (gameState.direction === 'UP' || gameState.direction === 'DOWN') {
          handleGesture(translationX > 0 ? 'RIGHT' : 'LEFT');
        }
      } else if (Math.abs(translationY) > Math.abs(translationX) * 2) {
        // Vertical swipe - only allow if currently moving horizontally
        if (gameState.direction === 'LEFT' || gameState.direction === 'RIGHT') {
          handleGesture(translationY > 0 ? 'DOWN' : 'UP');
        }
      }
    });

  // Add Rules Screen component
  const RulesScreen = () => (
    <View style={styles.rulesScreen}>
      <Text style={styles.rulesTitle}>CHROMA{'\n'}SNAKE</Text>
      <Text style={styles.snakeArt}>
        {'    ┌──┐     \n'}
        {'    │··│ ╷   \n'}
        {'    └┐│ ╵   \n'}
        {'     ││     \n'}
        {'     │└┐    \n'}
        {'     └─┘    \n'}
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

  // Add attempt phase text component
  const AttemptsDisplay = () => {
    const attemptNumber = gameState.isPractice 
      ? Math.max(1, 4 - gameState.practiceAttemptsLeft)
      : Math.max(1, 4 - gameState.realAttemptsLeft);

    return (
      <View style={styles.attemptsContainer}>
        <Text style={[styles.attemptsText, { color: gameState.isPractice ? COLORS.GREEN : COLORS.RED }]}>
          {`${gameState.isPractice ? 'PRACTICE' : 'REAL'} ${attemptNumber}/3`}
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
            <View style={[styles.gameBoard, { borderColor: gameState.snakeColor }]}>
              {/* Render snake */}
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

              {/* Render food */}
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

              {/* Render obstacles */}
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
              <Text style={[styles.attemptsText, { color: gameState.isPractice ? COLORS.GREEN : COLORS.RED }]}>
                {gameState.isPractice 
                  ? `Practice ${Math.max(1, 4 - gameState.practiceAttemptsLeft)}/3`
                  : `Real ${Math.max(1, 4 - gameState.realAttemptsLeft)}/3`}
              </Text>
              {(!gameState.isPractice && gameState.realAttemptsLeft <= 1) ? (
                <TouchableOpacity style={[styles.replayButton, { backgroundColor: COLORS.BLUE }]} onPress={resetGame}>
                  <Text style={[styles.replayText, { color: COLORS.BLACK }]}>LEADERBOARD</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.replayButton} onPress={resetGame}>
                  <Text style={styles.replayText}>
                    {gameState.isPractice && gameState.practiceAttemptsLeft <= 1
                      ? 'Start Real Game'
                      : 'Try Again'}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 2,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  scoreText: {
    color: COLORS.ORANGE,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  gameBoard: {
    width: GRID_WIDTH * CELL_SIZE,
    height: GRID_HEIGHT * CELL_SIZE,
    borderWidth: 4,
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'solid',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  gameOver: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.95)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverText: {
    color: COLORS.RED,
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 4,
    textShadowColor: 'rgba(255, 0, 0, 0.75)',
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
    borderColor: '#FFC04D',
    borderBottomColor: '#CC8400',
    borderRightColor: '#CC8400',
    minWidth: 200,
    alignItems: 'center',
  },
  replayText: {
    color: COLORS.BLACK,
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  rulesScreen: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: COLORS.BLACK,
    padding: 15,
    paddingTop: '10%',
  },
  rulesTitle: {
    color: COLORS.RED,
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 4,
    textShadowColor: 'rgba(255, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 1,
    marginBottom: 15,
    textAlign: 'center',
  },
  snakeArt: {
    color: COLORS.GREEN,
    fontSize: 20,
    fontFamily: 'monospace',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 255, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  rulesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    width: '100%',
    paddingHorizontal: 20,
  },
  rulesText: {
    color: COLORS.ORANGE,
    fontSize: 24,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 15,
    textShadowColor: 'rgba(255, 165, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    textAlign: 'center',
    width: '100%',
  },
  playButton: {
    backgroundColor: COLORS.GREEN,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 0,
    borderWidth: 4,
    borderColor: '#00FF00',
    borderBottomColor: '#008000',
    borderRightColor: '#008000',
  },
  playButtonText: {
    color: COLORS.BLACK,
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  attemptsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attemptsText: {
    color: COLORS.ORANGE,
    fontSize: 16,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: 'bold',
  },
});