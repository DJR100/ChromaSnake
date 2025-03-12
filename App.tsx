import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import Game from './src/components/Game';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar barStyle="light-content" />
      <Game />
    </SafeAreaView>
  );
} 