import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";

export default function App() {
  const [count, setCount] = React.useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.badge}>REACT NATIVE PREVIEW</Text>
      <Text style={styles.title}>Mobile Counter App</Text>
      <Text style={styles.subtitle}>
        Tested with Expo Web fast preview and Metro Native runtime.
      </Text>
      <View style={styles.card}>
        <Text style={styles.countText}>{count}</Text>
        <Pressable style={styles.button} onPress={() => setCount(count + 1)}>
          <Text style={styles.buttonText}>Tap to Count</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  badge: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    color: "#f4f4f5",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 8,
  },
  subtitle: {
    color: "#a1a1aa",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  countText: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#0284c7",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
});

