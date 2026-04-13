import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { departmentChannelService } from "../services/api/departmentChannelService";
import { Card, Button } from "../components";
import { roleToString } from "../utils/helpers";
import { useFocusEffect } from "@react-navigation/native";
import { useDepartmentChannel } from "../context/DepartmentChannelContext";

const MIN_OPTIONS = 2;

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatCloseDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const isPollClosed = (poll) =>
  poll.isClosed ||
  (poll.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now());

// ─── Poll ────────────────────────────────────────────────────────────────────

const PollItem = React.memo(({ poll, roleName, votingId, onVote }) => {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography),
    [colors, spacing, borderRadius, typography],
  );

  const closed = isPollClosed(poll);
  const canVote = !closed && !poll.hasVoted && roleName === "Employee";
  const isVoting = votingId === poll.id;
  const totalVotes = poll.options.reduce(
    (sum, o) => sum + (o.voteCount || 0),
    0,
  );

  return (
    <View style={styles.pollContainer}>
      <Text style={styles.pollQuestion}>{poll.question}</Text>

      {poll.expiresAt && (
        <Text style={styles.pollMeta}>
          {closed ? "Closed" : `Closes ${formatCloseDate(poll.expiresAt)}`}
        </Text>
      )}

      {poll.options.map((opt) => {
        const isSelected = poll.selectedOptionId === opt.id;
        const percent =
          totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;

        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={canVote ? 0.75 : 1}
            onPress={() => canVote && !isVoting && onVote(poll.id, opt.id)}
            style={[styles.pollOption, isSelected && styles.pollOptionSelected]}
            disabled={!canVote || isVoting}
          >
            <View style={styles.pollOptionHeader}>
              <Text
                style={[
                  styles.pollOptionText,
                  isSelected && styles.pollOptionTextSelected,
                ]}
                numberOfLines={2}
              >
                {opt.text}
              </Text>
              <Text style={styles.pollOptionPercent}>{percent}%</Text>
            </View>

            <View style={styles.pollBarBackground}>
              <View style={[styles.pollBarFill, { width: `${percent}%` }]} />
            </View>

            <Text style={styles.pollVoteCount}>
              {opt.voteCount} {opt.voteCount === 1 ? "vote" : "votes"}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={styles.pollFooterRow}>
        {isVoting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.pollFooter}>
            {poll.hasVoted
              ? "You voted"
              : closed
                ? "Poll closed"
                : canVote
                  ? "Tap to vote"
                  : null}
          </Text>
        )}
        <Text style={styles.pollTotalVotes}>{totalVotes} total</Text>
      </View>
    </View>
  );
});

// ─── Feed item ───────────────────────────────────────────────────────────────

const FeedItem = React.memo(
  ({ item, roleName, votingId, onVote, styles, colors }) => {
    const isPoll = item.messageType === "Poll";

    return (
      <Card style={styles.messageCard}>
        <View style={styles.messageHeader}>
          <View style={styles.senderRow}>
            <View style={styles.senderAvatar}>
              <Text style={styles.senderAvatarText}>
                {(item.senderName || "?")[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.senderMeta}>
              <Text style={styles.senderName}>{item.senderName}</Text>
              <Text style={styles.messageMeta}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            {item.isPinned && (
              <View style={[styles.pill, styles.pillPinned]}>
                <Ionicons name="pin" size={10} color={colors.warning} />
                <Text style={[styles.pillText, { color: colors.warning }]}>
                  Pinned
                </Text>
              </View>
            )}
            <View
              style={[
                styles.pill,
                isPoll ? styles.pillPoll : styles.pillMessage,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  isPoll ? styles.pillTextPoll : styles.pillTextMessage,
                ]}
              >
                {isPoll ? "Poll" : "Post"}
              </Text>
            </View>
          </View>
        </View>

        {isPoll ? (
          <PollItem
            poll={item.poll}
            roleName={roleName}
            votingId={votingId}
            onVote={onVote}
          />
        ) : (
          <Text style={styles.messageContent}>{item.content}</Text>
        )}
      </Card>
    );
  },
);

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function DepartmentChannelScreen() {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography),
    [colors, spacing, borderRadius, typography],
  );

  const headerHeight = useHeaderHeight();
  const flatListRef = useRef(null);

  const { user } = useAuth();
  const departmentId = user?.departmentId ?? user?.DepartmentId ?? null;
  const roleName = roleToString(user?.role);
  const isManager = roleName === "Manager" || roleName === "Admin";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);

  const [composerMode, setComposerMode] = useState("message");
  const [messageContent, setMessageContent] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState(null);
  const { refreshChannelInfo } = useDepartmentChannel();

  const markAsRead = async () => {
    try {
      await departmentChannelService.markRead();
    } catch (error) {
      console.log("Failed to mark channel as read", error);
    }
  };

  const loadFeed = useCallback(
    async (asRefresh = false) => {
      if (!departmentId) {
        setItems([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      try {
        if (asRefresh) setRefreshing(true);
        else setLoading(true);

        const res = await departmentChannelService.getFeed(departmentId);
        setItems(Array.isArray(res) ? res : (res?.data ?? []));
      } catch (error) {
        Alert.alert("Error", error?.message || "Could not load channel.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [departmentId],
  );

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        await loadFeed(false);
        await markAsRead();
        await refreshChannelInfo(); // 🔥 THIS updates the navbar badge
      };

      init();
    }, [loadFeed, refreshChannelInfo]),
  );

  const resetComposer = () => {
    setMessageContent("");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setComposerMode("message");
  };

  const handleAddPollOption = () => setPollOptions((prev) => [...prev, ""]);

  const handleChangePollOption = useCallback((index, value) => {
    setPollOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleSubmitMessage = async () => {
    if (!messageContent.trim()) return;
    setSubmitting(true);
    try {
      await departmentChannelService.createMessage({
        departmentId,
        content: messageContent.trim(),
        isPinned: false,
      });
      resetComposer();
      await loadFeed(false);
      await refreshChannelInfo();
    } catch (error) {
      Alert.alert("Error", error?.message || "Could not post message.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPoll = async () => {
    if (!pollQuestion.trim()) {
      Alert.alert("Required", "Poll question is required.");
      return;
    }
    const cleanedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (cleanedOptions.length < MIN_OPTIONS) {
      Alert.alert("Required", "Add at least two options.");
      return;
    }
    setSubmitting(true);
    try {
      await departmentChannelService.createPoll({
        departmentId,
        question: pollQuestion.trim(),
        options: cleanedOptions,
        allowMultipleChoices: false,
        expiresAt: null,
        isPinned: false,
      });
      resetComposer();
      await loadFeed(false);
      await refreshChannelInfo();
    } catch (error) {
      Alert.alert("Error", error?.message || "Could not create poll.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = useCallback(
    async (pollId, optionId) => {
      setVotingId(pollId);
      try {
        await departmentChannelService.votePoll({ pollId, optionId });
        await loadFeed(false);
        await refreshChannelInfo(); 
      } catch (error) {
        Alert.alert("Error", error?.message || "Could not submit vote.");
      } finally {
        setVotingId(null);
      }
    },
    [loadFeed],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <FeedItem
        item={item}
        roleName={roleName}
        votingId={votingId}
        onVote={handleVote}
        styles={styles}
        colors={colors}
      />
    ),
    [roleName, votingId, handleVote, styles, colors],
  );

  const keyExtractor = useCallback((item) => String(item.id), []);

  if (!user) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      {/* Feed — flex: 1 so it shrinks when keyboard opens, never overlaps composer */}
      <View style={styles.feedContainer}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={items}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={
              items.length === 0 ? styles.emptyList : styles.list
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadFeed(true)}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={28}
                    color={colors.textSecondary}
                  />
                </View>
                <Text style={styles.emptyTitle}>No posts yet</Text>
                <Text style={styles.emptySubtitle}>
                  Department updates and polls will appear here.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Composer — only for managers */}
      {isManager && (
        <View style={styles.composerContainer}>
          <View style={styles.composerTabs}>
            {["message", "poll"].map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.composerTab,
                  composerMode === mode && styles.composerTabActive,
                ]}
                onPress={() => setComposerMode(mode)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={
                    mode === "message" ? "create-outline" : "bar-chart-outline"
                  }
                  size={14}
                  color={
                    composerMode === mode
                      ? colors.textOnPrimary
                      : colors.textSecondary
                  }
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.composerTabText,
                    composerMode === mode && styles.composerTabTextActive,
                  ]}
                >
                  {mode === "message" ? "Post" : "Poll"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {composerMode === "message" ? (
            <View style={styles.composerBody}>
              <TextInput
                style={styles.input}
                placeholder="Share an update…"
                placeholderTextColor={colors.textSecondary}
                value={messageContent}
                onChangeText={setMessageContent}
                multiline
                blurOnSubmit={false}
              />
              <Button
                title={submitting ? "Posting…" : "Post"}
                onPress={handleSubmitMessage}
                loading={submitting}
                disabled={submitting || !messageContent.trim()}
                style={styles.composerButton}
              />
            </View>
          ) : (
            <View style={styles.composerBody}>
              <TextInput
                style={styles.input}
                placeholder="Ask a question…"
                placeholderTextColor={colors.textSecondary}
                value={pollQuestion}
                onChangeText={setPollQuestion}
                multiline
                blurOnSubmit={false}
              />

              {pollOptions.map((opt, index) => (
                <TextInput
                  key={index}
                  style={styles.optionInput}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor={colors.textSecondary}
                  value={opt}
                  onChangeText={(text) => handleChangePollOption(index, text)}
                  returnKeyType={
                    index === pollOptions.length - 1 ? "done" : "next"
                  }
                />
              ))}

              <View style={styles.pollActionsRow}>
                <TouchableOpacity
                  onPress={handleAddPollOption}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addOptionText}>+ Add option</Text>
                </TouchableOpacity>
              </View>

              <Button
                title={submitting ? "Creating…" : "Create poll"}
                onPress={handleSubmitPoll}
                loading={submitting}
                disabled={submitting}
                style={styles.composerButton}
              />
            </View>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (colors, spacing, borderRadius, typography) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // flex: 1 is critical — makes the list shrink upward when the keyboard
    // opens, keeping the composer always visible above it
    feedContainer: {
      flex: 1,
    },

    // ── Layout ──
    list: {
      padding: spacing.lg,
      paddingBottom: spacing.lg,
    },
    emptyList: {
      flexGrow: 1,
      padding: spacing.lg,
      justifyContent: "center",
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },

    // ── Empty state ──
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    emptySubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },

    // ── Feed card ──
    messageCard: {
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    messageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: spacing.sm,
    },
    senderRow: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    senderAvatar: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    senderAvatarText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.textOnPrimary,
    },
    senderMeta: {
      flex: 1,
    },
    senderName: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    messageMeta: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 1,
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
    },
    pillPinned: {
      backgroundColor: colors.warningLight,
    },
    pillPoll: {
      backgroundColor: colors.infoLight ?? colors.surfaceMuted,
    },
    pillMessage: {
      backgroundColor: colors.surfaceMuted,
    },
    pillText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
    },
    pillTextPoll: {
      color: colors.info ?? colors.primary,
    },
    pillTextMessage: {
      color: colors.textSecondary,
    },
    messageContent: {
      fontSize: typography.sm,
      color: colors.text,
      lineHeight: 20,
    },

    // ── Poll ──
    pollContainer: {
      marginTop: spacing.xs,
    },
    pollQuestion: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: spacing.xs,
      lineHeight: 20,
    },
    pollMeta: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    pollOption: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.xs,
      backgroundColor: colors.background,
    },
    pollOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    pollOptionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    pollOptionText: {
      fontSize: typography.sm,
      color: colors.text,
      flex: 1,
      marginRight: spacing.sm,
    },
    pollOptionTextSelected: {
      fontWeight: typography.semibold,
      color: colors.primary,
    },
    pollOptionPercent: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.textSecondary,
      minWidth: 32,
      textAlign: "right",
    },
    pollBarBackground: {
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
      marginBottom: 4,
    },
    pollBarFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    pollVoteCount: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    pollFooterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.sm,
    },
    pollFooter: {
      fontSize: typography.xs,
      color: colors.textSecondary,
    },
    pollTotalVotes: {
      fontSize: typography.xs,
      color: colors.textSecondary,
    },

    // ── Composer ──
    composerContainer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      backgroundColor: colors.surface,
    },
    composerTabs: {
      flexDirection: "row",
      marginBottom: spacing.md,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    composerTab: {
      flex: 1,
      flexDirection: "row",
      paddingVertical: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    composerTabActive: {
      backgroundColor: colors.primary,
    },
    composerTabText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      fontWeight: typography.medium,
    },
    composerTabTextActive: {
      color: colors.textOnPrimary,
      fontWeight: typography.semibold,
    },
    composerBody: {
      gap: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.sm,
      color: colors.text,
      backgroundColor: colors.background,
      textAlignVertical: "top",
      minHeight: 68,
      maxHeight: 120,
    },
    optionInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.sm,
      color: colors.text,
      backgroundColor: colors.background,
    },
    pollActionsRow: {
      flexDirection: "row",
    },
    addOptionText: {
      fontSize: typography.sm,
      color: colors.primary,
      fontWeight: typography.semibold,
    },
    composerButton: {
      marginTop: spacing.xs,
    },
  });
