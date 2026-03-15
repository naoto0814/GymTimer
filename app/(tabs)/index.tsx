import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
  originalIndex: number;
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
  const backgroundTimeRef = useRef<number | null>(null);
  const player = useAudioPlayer(require('../../assets/Clock-Alarm02-mp3/Clock-Alarm02/Clock-Alarm02-1(Loop).mp3'));

  const scheduleNotification = async (seconds: number) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'インターバル終了',
        body: '次のセットを始めましょう',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: seconds,
      },
    });
  };

  const playSound = async () => {
    player.volume = 1.0;
    player.seekTo(0);
    player.play();
    setTimeout(() => {
      player.pause();
    }, 2000)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem('exerciseList');
      if (saved) setExerciseList(JSON.parse(saved));
      await Notifications.requestPermissionsAsync();
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('exerciseList', JSON.stringify(exerciseList));
  }, [exerciseList]);

  useEffect(() => {
    // アプリの状態（開いているか、閉じているか）
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        if (backgroundTimeRef.current === null) {
          backgroundTimeRef.current = Date.now();
        }
      }
      if (nextAppState === 'active') {
        if (backgroundTimeRef.current !== null) {
          const timePassed = Math.floor((Date.now() - backgroundTimeRef.current) / 1000);
          if (isRunning) {
            setTimeLeft(prev => Math.max(prev - timePassed, 0));
          }
          backgroundTimeRef.current = null;
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isRunning]);

  useEffect(() => {
    if (timeLeft <= 0 && isRunning) {
      setIsRunning(false);
      clearInterval(intervalRef.current!);
      Notifications.cancelAllScheduledNotificationsAsync();
      playSound();

      if (currentExerciseIndex < timelineList.length - 1) {
        setCurrentExerciseIndex(prevIndex => prevIndex + 1);
        setTimeLeft(timelineList[currentExerciseIndex + 1].interval);
      }
    }
  }, [timeLeft, isRunning, currentExerciseIndex, timelineList]);

  useEffect(() => {
    const newTimeline: TimelineItem[] = [];
    exerciseList.forEach((exercise, index) => {
      for (let i = 1; i <= exercise.set; i++) {
        newTimeline.push({ name: exercise.name, interval: exercise.interval, currentSet: i, totalSets: exercise.set, originalIndex: index });
      }
    });
    setTimelineList(newTimeline);
  }, [exerciseList]);

  useEffect(() => {
    if (timelineList.length > 0) setTimeLeft(timelineList[0].interval);
  }, [timelineList,hasStarted]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.container}>
        {/* タイマー画面 */}
        <Text style={styles.exerciseName}>{timelineList[currentExerciseIndex]?.name ?? "種目を追加してください"}</Text>
        <Text style={styles.timer}>{formatTime(timeLeft)}</Text>
        <Text style={styles.setInfo}>
          {timelineList[currentExerciseIndex] ? `${timelineList[currentExerciseIndex].currentSet} / ${timelineList[currentExerciseIndex].totalSets} セット` : ""}
        </Text>

        <View style={styles.btnRow}>
          <TouchableOpacity 
          style={[styles.btn, isEditing&&{opacity:0.4}]} 
          disabled={isEditing}

          onPress={() => {
            if (isRunning) {
              clearInterval(intervalRef.current!);
              setIsRunning(false);
              Notifications.cancelAllScheduledNotificationsAsync();
            } else {
              setIsRunning(true);
              setHasStarted(true);
              scheduleNotification(timeLeft);
              intervalRef.current = setInterval(() => {
                setTimeLeft(prev => prev - 1);
              }, 1000);
            }
          }}>
            <Text style={styles.btnText}>{isRunning ? 'ストップ' : 'スタート'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
          style={[styles.btn, isEditing&&{opacity:0.4}]}
          disabled={isEditing}

          onPress={() => {
            if (currentExerciseIndex >= timelineList.length - 1) return;
            clearInterval(intervalRef.current!);
            setCurrentExerciseIndex(prevIndex => prevIndex + 1);
            setTimeLeft(timelineList[currentExerciseIndex + 1].interval);
            setIsRunning(false);
            Notifications.cancelAllScheduledNotificationsAsync();
          }}>
            <Text style={styles.btnText}>スキップ</Text>
          </TouchableOpacity>
        </View>

        {/* 種目リスト */}
        {exerciseList.map((ex, index) => {
          const isActive = timelineList[currentExerciseIndex]?.originalIndex === index;
          return (
            <View
              key={index}
              style={[
                styles.exerciseRow,
                isActive && { backgroundColor: '#333', borderRadius: 8, paddingHorizontal: 10 }
              ]}
            >
              <Text
                style={[
                  styles.exerciseNameText,
                  isActive && { color: '#4CAF50', fontWeight: 'bold' }
                ]}
                numberOfLines={1}
              >
                {ex.name}
              </Text>

              <View style={styles.numberWrap}>
                <Text style={styles.numberText}>{ex.set} セット</Text>
                <Text style={styles.numberText}>{ex.interval} 秒</Text>
              </View>
              {/* 💡 isEditing が true の時だけ、このボタン全体を描画する */}
              {isEditing && (
                <TouchableOpacity onPress={() => setExerciseList(prev => prev.filter((_, i) => i !== index))}>
                  <Text style={styles.deleteBtn}>削除</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* 編集ボタン */}
        <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(prev => !prev)}>
          <Text style={styles.btnText}>{isEditing ? '完了' : '編集'}</Text>
        </TouchableOpacity>

        {/* 入力欄 */}
        {isEditing && (
          <View style={styles.inputArea}>
            <TextInput style={styles.input} placeholder="種目名" placeholderTextColor="#888" value={newExerciseName} onChangeText={setNewExerciseName} />
            <TextInput style={styles.input} placeholder="セット数" placeholderTextColor="#888" keyboardType="numeric" value={newExerciseSet} onChangeText={setNewExerciseSet} />
            <TextInput style={styles.input} placeholder="インターバル（秒）" placeholderTextColor="#888" keyboardType="numeric" value={newExerciseInterval} onChangeText={setNewExerciseInterval} />
            <TouchableOpacity style={[styles.btn, { alignSelf: 'center' }]} onPress={() => {
              if (!newExerciseName || !newExerciseSet || !newExerciseInterval) return;
              setExerciseList(prev => [...prev, { name: newExerciseName, set: parseInt(newExerciseSet), interval: parseInt(newExerciseInterval) }]);
              setNewExerciseName(""); setNewExerciseSet(""); setNewExerciseInterval("");
            }}>
              <Text style={styles.btnText}>追加</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  exerciseName: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  timer: {
    color: '#ffffff',
    fontSize: 120,
    fontWeight: 'bold',
    letterSpacing: 5,
    marginBottom: 10,
  },
  setInfo: {
    color: '#aaaaaa',
    fontSize: 24,
    marginBottom: 30,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 40,
  },
  btn: {
    backgroundColor: '#333',
    borderColor: '#555',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 20,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    borderBottomColor: '#333',
    borderBottomWidth: 1,
  },
  exerciseNameText: {
    color: '#ffffff',
    fontSize: 18,
    flex: 1,
    marginRight: 10,
  },
  numberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberText: {
    color: '#aaaaaa',
    fontSize: 16,
    width: 65,
    textAlign: 'right',
  },
  exerciseText: {
    color: '#ffffff',
    fontSize: 18,
  },
  deleteBtn: {
    color: '#ff4444',
    fontSize: 16,
  },
  editBtn: {
    marginTop: 20,
    backgroundColor: '#333',
    borderColor: '#555',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  inputArea: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  input: {
    backgroundColor: '#333',
    color: '#ffffff',
    borderColor: '#555',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});