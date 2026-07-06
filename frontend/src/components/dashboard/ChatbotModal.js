import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";
import { adminChatbotService } from "../../services/api";

const initialChatMessages = [
  {
    role: "assistant",
    text: "Bonjour, je peux vous aider avec les statistiques, demandes, approbations et refus.",
  },
];

const ChatbotModal = ({ statisticsFilters = {} }) => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState(initialChatMessages);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);

  const sendChatMessage = useCallback(async () => {
    const question = chatInput.trim();

    if (!question || chatLoading) return;

    const historySnapshot = chatMessages;

    setChatMessages((prev) => [...prev, { role: "user", text: question }]);
    setChatInput("");
    setChatError(null);
    setChatLoading(true);

    try {
      const response = await adminChatbotService.ask(
        question,
        historySnapshot,
        statisticsFilters,
      );
      const answer =
        response?.answer ??
        response?.message ??
        "Je n'ai pas pu générer une réponse claire pour cette demande.";

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: answer,
        },
      ]);
    } catch (error) {
      setChatError(
        error?.message ?? "Impossible de contacter l'assistant pour le moment.",
      );
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, statisticsFilters]);

  const clearChat = useCallback(() => {
    if (chatLoading) return;
    setChatMessages([]);
    setChatError(null);
  }, [chatLoading]);

  return (
    <>
      <Pressable
        style={[
          styles.chatFab,
          { bottom: Math.max(insets.bottom, 14) + 86 },
        ]}
        onPress={() => setChatOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir l'assistant IA Admin"
      >
        <Ionicons name="sparkles" size={24} color={colors.textOnPrimary} />
      </Pressable>

      <Modal
        transparent
        animationType="fade"
        visible={chatOpen}
        onRequestClose={() => setChatOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.chatOverlay}
        >
          <Pressable
            style={styles.chatBackdrop}
            onPress={() => setChatOpen(false)}
          />

          <View style={styles.chatDialog}>
            <View style={styles.chatHeader}>
              <View style={styles.chatTitleRow}>
                <View style={styles.chatHeaderIcon}>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                </View>
                <Text style={styles.chatTitle}>Assistant IA Admin</Text>
              </View>

              <View style={styles.chatHeaderActions}>
                <Pressable
                  style={styles.chatHeaderButton}
                  onPress={clearChat}
                  hitSlop={10}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>

                <Pressable
                  style={styles.chatCloseButton}
                  onPress={() => setChatOpen(false)}
                  hitSlop={10}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.chatHistory}
              contentContainerStyle={styles.chatHistoryContent}
              showsVerticalScrollIndicator={false}
            >
              {chatMessages.map((message, idx) => {
                const mine = message.role === "user";
                return (
                  <View
                    key={`${message.role}-${idx}`}
                    style={[
                      styles.chatBubble,
                      mine ? styles.chatBubbleUser : styles.chatBubbleAssistant,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatBubbleText,
                        mine
                          ? styles.chatBubbleUserText
                          : styles.chatBubbleAssistantText,
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                );
              })}

              {chatLoading ? (
                <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                  <View style={styles.chatLoadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.chatBubbleAssistantText}>
                      Analyse en cours...
                    </Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {chatError ? <Text style={styles.chatError}>{chatError}</Text> : null}

            <View style={styles.chatInputRow}>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Posez une question..."
                placeholderTextColor={colors.textMuted}
                style={styles.chatInput}
                editable={!chatLoading}
                multiline
              />

              <Pressable
                style={[
                  styles.chatSendButton,
                  (!chatInput.trim() || chatLoading) &&
                    styles.chatSendButtonDisabled,
                ]}
                onPress={sendChatMessage}
                disabled={!chatInput.trim() || chatLoading}
              >
                <Ionicons name="send" size={18} color={colors.textOnPrimary} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    chatFab: {
      position: "absolute",
      right: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.md,
      elevation: 8,
      zIndex: 1000,
    },

    chatOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },

    chatBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(15, 23, 42, 0.45)",
    },

    chatDialog: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.xl + 78,
      maxHeight: "72%",
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      ...shadows.md,
      elevation: 10,
    },

    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    chatTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flex: 1,
    },

    chatHeaderIcon: {
      width: 30,
      height: 30,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primaryLight ?? `${colors.primary}18`,
      alignItems: "center",
      justifyContent: "center",
    },

    chatTitle: {
      flex: 1,
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
    },

    chatCloseButton: {
      width: 34,
      height: 34,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted ?? colors.background,
    },

    chatHeaderActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    chatHeaderButton: {
      width: 34,
      height: 34,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted ?? colors.background,
    },

    chatHistory: {
      maxHeight: 320,
      backgroundColor: colors.background,
    },

    chatHistoryContent: {
      padding: spacing.md,
      gap: spacing.sm,
    },

    chatBubble: {
      maxWidth: "86%",
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },

    chatBubbleUser: {
      alignSelf: "flex-end",
      backgroundColor: colors.primary,
    },

    chatBubbleAssistant: {
      alignSelf: "flex-start",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    chatBubbleText: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      lineHeight: 19,
    },

    chatBubbleUserText: {
      color: colors.textOnPrimary,
    },

    chatBubbleAssistantText: {
      color: colors.text,
    },

    chatLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    chatError: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.medium,
      color: colors.error ?? "#dc2626",
    },

    chatInputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },

    chatInput: {
      flex: 1,
      minHeight: 42,
      maxHeight: 96,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.text,
      textAlignVertical: "top",
    },

    chatSendButton: {
      width: 42,
      height: 42,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    chatSendButtonDisabled: {
      opacity: 0.45,
    },
  });

export default ChatbotModal;
