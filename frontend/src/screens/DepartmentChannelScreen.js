import logger from "../utils/logger";
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
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { departmentChannelService } from "../services/api/departmentChannelService";
import { Card, Button } from "../components";
import { useRoles } from "../hooks/useRoles";
import { useFocusEffect } from "@react-navigation/native";
import { useDepartmentChannel } from "../context/DepartmentChannelContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Animated } from "react-native";

const MIN_OPTIONS = 2;
const FLOATING_TAB_SPACE = 95;

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

const PollItem = React.memo(
  ({
    poll,
    canVotePoll,
    canViewPollVoters,
    votingId,
    loadingVotersOptionId,
    onVote,
    onOpenVoters,
  }) => {
  const { colors, spacing, borderRadius, typography } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography),
    [colors, spacing, borderRadius, typography],
  );

  const closed = isPollClosed(poll);
  const canVote = !closed && !poll.hasVoted && canVotePoll;
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
          {closed ? "Clôturé" : `Clôture le ${formatCloseDate(poll.expiresAt)}`}
        </Text>
      )}

      {poll.options.map((opt) => {
        const isSelected = poll.selectedOptionId === opt.id;
        const percent =
          totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
        const isLoadingVotersOption = loadingVotersOptionId === opt.id;
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

            {canViewPollVoters && (
              <View style={styles.pollVotersBlock}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    onOpenVoters(poll.id, opt.id, opt.text);
                  }}
                  style={styles.pollVotersToggle}
                  disabled={isLoadingVotersOption}
                >
                  {isLoadingVotersOption ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.pollVotersToggleText}>
                      Voir les participants
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={styles.pollFooterRow}>
        {isVoting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.pollFooter}>
            {poll.hasVoted
              ? "Vous avez voté"
              : closed
                ? "Sondage clôturé"
                : canVote
                  ? "Appuyez pour voter"
                  : null}
          </Text>
        )}
        <Text style={styles.pollTotalVotes}>{totalVotes} au total</Text>
      </View>
    </View>
  );
  },
);

const FeedItem = React.memo(
  ({
    item,
    canVotePoll,
    canViewPollVoters,
    votingId,
    loadingVotersOptionId,
    onVote,
    onOpenVoters,
    styles,
    colors,
  }) => {
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
                  Épinglé
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
                {isPoll ? "Sondage" : "Publication"}
              </Text>
            </View>
          </View>
        </View>

        {isPoll ? (
          <PollItem
            poll={item.poll}
            canVotePoll={canVotePoll}
            canViewPollVoters={canViewPollVoters}
            votingId={votingId}
            loadingVotersOptionId={loadingVotersOptionId}
            onVote={onVote}
            onOpenVoters={onOpenVoters}
          />
        ) : (
          <Text style={styles.messageContent}>{item.content}</Text>
        )}
      </Card>
    );
  },
);

export default function DepartmentChannelScreen({ isActiveRoute = false }) {
  const { colors, spacing, borderRadius, typography } = useTheme();

  // --- Temporary diagnostics (remove later) ---
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  logger.debug(
    `[DepartmentChannelScreen] render #${renderCountRef.current} (ts=${Date.now()})`,
  );

  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography),
    [colors, spacing, borderRadius, typography],
  );

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();
  const { canPublishDepartmentChannel, canVotePoll, isManager } = useRoles();
  const { refreshChannelInfo } = useDepartmentChannel();
  const departmentId = user?.departmentId ?? user?.DepartmentId ?? null;

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);

  const [composerMode, setComposerMode] = useState("message");
  const [messageContent, setMessageContent] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState(null);
  const [pollVotersByPollId, setPollVotersByPollId] = useState({});
  const [selectedVotersOption, setSelectedVotersOption] = useState(null);
  const [loadingVotersPollId, setLoadingVotersPollId] = useState(null);

  const canViewPollVoters = isManager === true;

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadFeed = useCallback(async (asRefresh = false) => {
    try {
      if (asRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await departmentChannelService.getMyFeed();
      setItems(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (error) {
      Alert.alert(
        "Erreur",
        error?.message || "Impossible de charger le canal.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const isActive = isActiveRoute === true;

      logger.debug(
        `[DepartmentChannelScreen] useFocusEffect fired (ts=${Date.now()}) isActive=${isActive}`,
      );

      if (!isActive) {
        logger.debug(
          `[DepartmentChannelScreen] skipping Canal init because route is not active (ts=${Date.now()})`,
        );

        return undefined;
      }

      let cancelled = false;

      const init = async () => {
        await loadFeed(false);

        if (cancelled) return;

        try {
          logger.debug(
            `[DepartmentChannelScreen] immediately before POST /DepartmentChannel/mark-read (ts=${Date.now()})`,
          );

          await departmentChannelService.markRead();

          if (cancelled) return;

          logger.debug(
            `[DepartmentChannelScreen] after mark-read success (ts=${Date.now()})`,
          );

          await refreshChannelInfo();
        } catch (error) {
          logger.debug(
            `[DepartmentChannelScreen] mark-read failed (ts=${Date.now()})`,
            error,
          );
        }
      };

      init();

      return () => {
        cancelled = true;

        logger.debug(
          `[DepartmentChannelScreen] useFocusEffect cleanup (ts=${Date.now()})`,
        );
      };
    }, [isActiveRoute, loadFeed, refreshChannelInfo]),
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
      Alert.alert(
        "Erreur",
        error?.message || "Impossible de publier le message.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPoll = async () => {
    if (!pollQuestion.trim()) {
      Alert.alert("Requis", "La question du sondage est requise.");
      return;
    }

    const cleanedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);

    if (cleanedOptions.length < MIN_OPTIONS) {
      Alert.alert("Requis", "Ajoutez au moins deux options.");
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
      Alert.alert(
        "Erreur",
        error?.message || "Impossible de créer le sondage.",
      );
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
        Alert.alert(
          "Erreur",
          error?.message || "Impossible d'envoyer le vote.",
        );
      } finally {
        setVotingId(null);
      }
    },
    [loadFeed, refreshChannelInfo],
  );

  const handleOpenVoters = useCallback(
    async (pollId, optionId, optionText) => {
      if (!canViewPollVoters) return;

      setSelectedVotersOption({ pollId, optionId, optionText });

      if (pollVotersByPollId[pollId] || loadingVotersPollId === pollId) {
        return;
      }

      setLoadingVotersPollId(pollId);

      try {
        const res = await departmentChannelService.getPollVoters(pollId);
        const votersData = res?.data ?? res;

        setPollVotersByPollId((prev) => ({
          ...prev,
          [pollId]: votersData,
        }));
      } catch (error) {
        setSelectedVotersOption(null);
        Alert.alert(
          "Erreur",
          error?.message || "Impossible de charger les participants.",
        );
      } finally {
        setLoadingVotersPollId(null);
      }
    },
    [
      canViewPollVoters,
      loadingVotersPollId,
      pollVotersByPollId,
    ],
  );

  const handleCloseVoters = useCallback(() => {
    setSelectedVotersOption(null);
  }, []);

  const renderItem = useCallback(
    ({ item }) => (
      <FeedItem
        item={item}
        canVotePoll={canVotePoll}
        canViewPollVoters={canViewPollVoters}
        votingId={votingId}
        loadingVotersOptionId={
          loadingVotersPollId === item.poll?.id
            ? selectedVotersOption?.optionId
            : null
        }
        onVote={handleVote}
        onOpenVoters={handleOpenVoters}
        styles={styles}
        colors={colors}
      />
    ),
    [
      canVotePoll,
      canViewPollVoters,
      votingId,
      loadingVotersPollId,
      selectedVotersOption,
      handleVote,
      handleOpenVoters,
      styles,
      colors,
    ],
  );

  const keyExtractor = useCallback((item) => String(item.id), []);
  const voterKeyExtractor = useCallback(
    (item, index) => String(item?.userId ?? item?.UserId ?? index),
    [],
  );

  const selectedVotersData = selectedVotersOption
    ? pollVotersByPollId[selectedVotersOption.pollId]
    : null;

  const selectedOptionVoters =
    selectedVotersData?.options?.find(
      (option) => option.optionId === selectedVotersOption?.optionId,
    )?.voters ?? [];

  const isSelectedVotersLoading =
    selectedVotersOption &&
    loadingVotersPollId === selectedVotersOption.pollId &&
    !selectedVotersData;

  const renderVoter = useCallback(
    ({ item }) => {
      const userId = item?.userId ?? item?.UserId;
      const userName =
        item?.userName ?? item?.UserName ?? item?.name ?? item?.Name;

      return (
        <View style={styles.voterRow}>
          <Ionicons
            name="person-circle-outline"
            size={22}
            color={colors.primary}
          />
          <View style={styles.voterInfo}>
            <Text style={styles.voterName}>
              {userName || "Participant inconnu"}
            </Text>
          </View>
        </View>
      );
    },
    [colors.primary, styles],
  );

  if (!user) return null;

  const composerBottomPadding = keyboardVisible
    ? spacing.sm
    : spacing.lg + insets.bottom + FLOATING_TAB_SPACE;

  const keyboardAvoidingBehavior =
    Platform.OS === "ios" ? "padding" : "padding";

  const keyboardVerticalOffset =
    Platform.OS === "ios" ? headerHeight : FLOATING_TAB_SPACE;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={keyboardAvoidingBehavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={styles.feedContainer}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={
              items.length === 0
                ? styles.emptyList
                : [
                    styles.list,
                    {
                      paddingBottom: keyboardVisible
                        ? spacing.lg
                        : spacing.lg + 12,
                    },
                  ]
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
                <Text style={styles.emptyTitle}>
                  Aucune publication pour le moment
                </Text>
                <Text style={styles.emptySubtitle}>
                  Les actualités du département et les sondages apparaîtront
                  ici.
                </Text>
              </View>
            }
          />
        )}
      </View>

      <Modal
        visible={Boolean(selectedVotersOption)}
        transparent
        animationType="fade"
        onRequestClose={handleCloseVoters}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleCloseVoters}>
          <Pressable
            style={styles.votersModal}
            onPress={(event) => event?.stopPropagation?.()}
          >
            <View style={styles.votersModalHeader}>
              <View style={styles.votersModalTitleBlock}>
                <Text style={styles.votersModalTitle}>
                  Participants ayant voté
                </Text>
                {selectedVotersOption?.optionText ? (
                  <Text style={styles.votersModalSubtitle} numberOfLines={2}>
                    {selectedVotersOption.optionText}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={handleCloseVoters}
                activeOpacity={0.75}
                style={styles.votersModalClose}
                accessibilityRole="button"
                accessibilityLabel="Fermer"
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {isSelectedVotersLoading ? (
              <View style={styles.votersModalState}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={selectedOptionVoters}
                keyExtractor={voterKeyExtractor}
                renderItem={renderVoter}
                style={styles.votersList}
                contentContainerStyle={
                  selectedOptionVoters.length === 0
                    ? styles.votersListEmptyContent
                    : styles.votersListContent
                }
                ListEmptyComponent={
                  <Text style={styles.pollVotersEmpty}>
                    Aucun participant
                  </Text>
                }
                keyboardShouldPersistTaps="handled"
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {canPublishDepartmentChannel && (
        <Animated.View
          style={[
            styles.composerContainer,
            {
              paddingBottom: composerBottomPadding,
            },
          ]}
        >
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
                  {mode === "message" ? "Message" : "Sondage"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {composerMode === "message" ? (
            <View style={styles.composerBody}>
              <TextInput
                style={[
                  styles.input,
                  keyboardVisible && { minHeight: 52, maxHeight: 70 },
                ]}
                placeholder="Partager une mise à jour…"
                placeholderTextColor={colors.textSecondary}
                value={messageContent}
                onChangeText={setMessageContent}
                multiline
                blurOnSubmit={false}
              />

              <Button
                title={submitting ? "Publication…" : "Publier"}
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
                placeholder="Poser une question…"
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
                  <Text style={styles.addOptionText}>+ Ajouter une option</Text>
                </TouchableOpacity>
              </View>

              <Button
                title={submitting ? "Création…" : "Créer le sondage"}
                onPress={handleSubmitPoll}
                loading={submitting}
                disabled={submitting}
                style={styles.composerButton}
              />
            </View>
          )}
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors, spacing, borderRadius, typography) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    feedContainer: {
      flex: 1,
    },

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

    pollVotersBlock: {
      marginTop: spacing.xs,
    },

    pollVotersToggle: {
      alignSelf: "flex-start",
      paddingVertical: 3,
    },

    pollVotersToggleText: {
      fontSize: typography.xs,
      color: colors.primary,
      fontWeight: typography.semibold,
    },

    pollVotersEmpty: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontStyle: "italic",
      textAlign: "center",
      paddingVertical: spacing.lg,
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },

    votersModal: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "72%",
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },

    votersModalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    votersModalTitleBlock: {
      flex: 1,
      paddingRight: spacing.md,
    },

    votersModalTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    votersModalSubtitle: {
      marginTop: 3,
      fontSize: typography.xs,
      color: colors.textSecondary,
      lineHeight: 17,
    },

    votersModalClose: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },

    votersModalState: {
      minHeight: 140,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },

    votersList: {
      maxHeight: 360,
    },

    votersListContent: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },

    votersListEmptyContent: {
      minHeight: 140,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },

    voterRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    voterInfo: {
      flex: 1,
      marginLeft: spacing.sm,
    },

    voterName: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.text,
    },

    voterMeta: {
      marginTop: 2,
      fontSize: typography.xs,
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

    composerContainer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
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
