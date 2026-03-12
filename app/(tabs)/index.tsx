import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';

type ExerciseItem = {
  name: string;
  set: number;
  interval: number;
}

type TimelineItem = {
  name: string;
  interval: number;
  currentSet: number;
  totalSets: number;
}

export default function HomeScreen() {
  const [exerciseList, setExerciseList] = useState<ExerciseItem[]>([]);
  const [timelineList, setTimelineList] = useState<TimelineItem[]>([]);

  const [timeLeft, setTimeLeft] = useState(0);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseSet, setNewExerciseSet] = useState("");
  const [newExerciseInterval, setNewExerciseInterval] = useState("");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const player = useAudioPlayer(require('../../assets/Clock-Alarm02-mp3/Clock-Alarm02/Clock-Alarm02-1(Loop).mp3'));

  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem('exerciseList');
      if (saved) {
        setExerciseList(JSON.parse(saved));
      }
    };
    load();
  }, []);
  useEffect(() => {
    AsyncStorage.setItem('exerciseList', JSON.stringify(exerciseList));
  }, [exerciseList]);

  useEffect(() => {
    const newTimeline: TimelineItem[] = [];

    exerciseList.forEach(exercise => {
      for (let i = 1; i <= exercise.set; i++) {
        newTimeline.push({
          name: exercise.name,
          interval: exercise.interval,
          currentSet: i,
          totalSets: exercise.set
        });
      }
    });
    setTimelineList(newTimeline);
  }, [exerciseList]);

  useEffect(() => {
    if (timelineList.length > 0) {
      setTimeLeft(timelineList[0].interval);
    }
  }, [timelineList]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>{timelineList[currentExerciseIndex]?.name ?? ""}</Text>
      <Text>{timeLeft}</Text>
      <Text>{timelineList[currentExerciseIndex]?.currentSet}/{timelineList[currentExerciseIndex]?.totalSets}セット</Text>
      <TouchableOpacity onPress={() => {
        if (isRunning) {
          clearInterval(intervalRef.current!);
          setIsRunning(false);
        } else {
          setIsRunning(true);
          intervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
              if (prev <= 0) {
                setIsRunning(false);
                clearInterval(intervalRef.current!);
                if (currentExerciseIndex < timelineList.length - 1) {
                  setCurrentExerciseIndex(prevIndex => prevIndex + 1);
                  setTimeLeft(timelineList[currentExerciseIndex + 1].interval);
                }
                player.volume = 1.0;
                player.seekTo(0);
                player.play();
                setTimeout(() => {                  
                   player.pause();
                }, 2000);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      }}>
        <Text>{isRunning ? 'ストップ' : 'スタート'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => {
        if (currentExerciseIndex >= timelineList.length - 1) return;
        clearInterval(intervalRef.current!);
        setCurrentExerciseIndex(prevIndex => prevIndex + 1);
        setTimeLeft(timelineList[currentExerciseIndex + 1].interval);
        setIsRunning(false);
      }}>
        <Text>スキップ</Text>
      </TouchableOpacity>

      {exerciseList.map((ex, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text>{ex.name} - {ex.set}セット - {ex.interval}秒</Text>
          <TouchableOpacity onPress={() => {
            setExerciseList(prev => prev.filter((_, i) => i !== index));
          }}>
            <Text>削除</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity onPress={() => setIsEditing(prev => !prev)}>
        <Text>{isEditing ? '完了' : '編集'}</Text>
      </TouchableOpacity>

      <TextInput
        placeholder="種目名"
        value={newExerciseName}
        onChangeText={setNewExerciseName}
      />
      <TextInput
        placeholder="セット数"
        keyboardType="numeric"
        value={newExerciseSet}
        onChangeText={setNewExerciseSet}
      />
      <TextInput
        placeholder="インターバル"
        keyboardType="numeric"
        value={newExerciseInterval}
        onChangeText={setNewExerciseInterval}
      />

      <TouchableOpacity onPress={() => {
        if (!newExerciseName || !newExerciseSet || !newExerciseInterval) return;
        const newExercise: ExerciseItem = {
          name: newExerciseName,
          set: parseInt(newExerciseSet),
          interval: parseInt(newExerciseInterval),
        }
        setExerciseList(prev => [...prev, newExercise]);

        setNewExerciseName("");
        setNewExerciseSet("");
        setNewExerciseInterval("");
      }}>
        <Text>追加</Text>
      </TouchableOpacity>

    </View>
  );
}
