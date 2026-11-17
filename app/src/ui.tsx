// Look: the black of a بيت شعر at night. Saudi games wear Sadu red + wool white,
// Egyptian games wear ahwa-wall teal + tea-glass amber.
import { ReactNode, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle, TextInputProps } from "react-native";
import { Category } from "./content";

export const C = {
  ground: "#15100e",
  surface: "#211916",
  line: "#3b2f2a",
  wool: "#efe6d8",
  muted: "#a99b8b",
  red: "#b3262e",
  teal: "#1f7a78",
  amber: "#d99a2b",
};
export const accent = (c?: Category) => (c === "egypt" ? C.teal : C.red);

export const F = { head: "ReemKufi_700Bold", body: "IBMPlexSansArabic_400Regular", bold: "IBMPlexSansArabic_700Bold" };

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ backgroundColor: C.ground }} contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      <View style={s.inner}>{children}</View>
    </ScrollView>
  );
}

export const Title = ({ children, size = 30 }: { children: ReactNode; size?: number }) => (
  <Text style={[s.title, { fontSize: size, lineHeight: size * 1.5 }]}>{children}</Text>
);
export const Body = ({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) => (
  <Text style={[s.body, muted && { color: C.muted }, style]}>{children}</Text>
);

type BtnProps = { label: string; onPress: () => void | Promise<unknown>; kind?: "main" | "ghost" | "danger"; color?: string; disabled?: boolean; style?: ViewStyle };
/** Shows its own busy state while the server answers, so a double tap can't send twice. */
export function Btn({ label, onPress, kind = "main", color = C.red, disabled, style }: BtnProps) {
  const [busy, setBusy] = useState(false);
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={async () => { setBusy(true); try { await onPress(); } finally { setBusy(false); } }}
      style={({ pressed }) => [
        s.btn,
        kind === "main" && { backgroundColor: color },
        kind === "ghost" && { borderWidth: 1.5, borderColor: C.line },
        kind === "danger" && { borderWidth: 1.5, borderColor: C.red },
        pressed && { transform: [{ translateY: 2 }], opacity: 0.85 },
        off && { opacity: 0.45 },
        style,
      ]}
    >
      <Text style={[s.btnText, kind !== "main" && { color: kind === "danger" ? "#ff8a8f" : C.wool }]}>{busy ? "..." : label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput placeholderTextColor={C.muted} {...props} style={[s.input, props.style]} />
    </View>
  );
}

export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;

export const ErrorLine = ({ text }: { text?: string | null }) =>
  text ? <Text accessibilityLiveRegion="polite" style={s.error}>{text}</Text> : null;

/** Sadu ضروس: a band of red and wool triangles. Egyptian games get a row of teal/amber lozenges. */
export function Band({ category = "saudi" }: { category?: Category }) {
  const n = 14;
  if (category === "egypt") {
    return (
      <View style={s.band} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={[s.lozenge, { backgroundColor: i % 3 === 1 ? C.amber : C.teal }]} />
        ))}
      </View>
    );
  }
  return (
    <View style={s.band} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[s.tri, i % 2 ? { borderTopWidth: 14, borderTopColor: C.wool } : { borderBottomWidth: 14, borderBottomColor: C.red }]} />
      ))}
    </View>
  );
}

/** Secret card: visible only while the finger is on it, so the person beside you can't read it. */
export function HoldCard({ children, onSeen, color = C.red }: { children: ReactNode; onSeen?: () => void; color?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="اضغط مطوّل لرؤية سرّك"
      onPressIn={() => { setOpen(true); onSeen?.(); }}
      onPressOut={() => setOpen(false)}
      style={[s.hold, { borderColor: color }, open && { backgroundColor: C.surface }]}
    >
      {open ? children : (
        <View style={{ alignItems: "center", gap: 8 }}>
          <Text style={[s.title, { fontSize: 22, lineHeight: 34 }]}>كرتك</Text>
          <Body muted>اضغط مطوّل وشوف — لا تخلّي أحد يشوف</Body>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Seconds left, counted on this phone from the server's "msLeft" (so phone clocks don't matter).
 * The deadline resets when `key` changes; `onEnd` fires once per key when it reaches 0.
 */
export function useCountdown(msLeft: number | undefined, key: string, onEnd?: () => void) {
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const fired = useRef("");
  useEffect(() => { if (msLeft != null) setDeadline(Date.now() + msLeft); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  useEffect(() => {
    if (left === 0 && fired.current !== key) { fired.current = key; onEnd?.(); }
  }, [left, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return left;
}

/** Band + game title + host's "end game" link, shared by game screens. */
export function GameTop({ title, category, host, onEnd }: { title: string; category: Category; host: boolean; onEnd: () => void }) {
  return (
    <>
      <Band category={category} />
      <Row style={{ justifyContent: "space-between" }}>
        <Title size={26}>{title}</Title>
        {host && (
          <Pressable accessibilityRole="button" onPress={onEnd} hitSlop={10}>
            <Text style={{ fontFamily: F.bold, color: C.muted, fontSize: 14 }}>إنهاء اللعبة</Text>
          </Pressable>
        )}
      </Row>
    </>
  );
}

export const Row =({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[{ flexDirection: "row", gap: 10, alignItems: "center" }, style]}>{children}</View>;

const s = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },
  inner: { width: "100%", maxWidth: 520, alignSelf: "center", gap: 18 },
  title: { fontFamily: F.head, color: C.wool, textAlign: "right" },
  body: { fontFamily: F.body, color: C.wool, fontSize: 16, lineHeight: 26, textAlign: "right" },
  label: { fontFamily: F.bold, color: C.muted, fontSize: 14, textAlign: "right" },
  btn: { minHeight: 54, borderRadius: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  btnText: { fontFamily: F.bold, color: "#fff", fontSize: 17 },
  input: { fontFamily: F.body, minHeight: 54, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.surface, color: C.wool, fontSize: 18, paddingHorizontal: 14, textAlign: "right" },
  card: { backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
  error: { fontFamily: F.bold, color: "#ff8a8f", fontSize: 15, textAlign: "right" },
  band: { flexDirection: "row", height: 14, overflow: "hidden", justifyContent: "center" },
  tri: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderLeftColor: "transparent", borderRightColor: "transparent", marginHorizontal: -3 },
  lozenge: { width: 10, height: 10, marginHorizontal: 5, marginTop: 2, transform: [{ rotate: "45deg" }] },
  hold: { minHeight: 220, borderRadius: 6, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", padding: 20 },
});
