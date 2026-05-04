import React, { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView } from "react-native";
import { adminLayoutService } from "../../services/api/adminLayoutService";
import { adminOfficeTableService } from "../../services/api/adminOfficeTableService";
import { adminSeatService } from "../../services/api/adminSeatService";
import DraggableItem from "../../components/DraggableItem";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Pattern, Rect, Line, Circle } from "react-native-svg";

const AdminOfficeLayoutScreen = () => {
  const { colors, typography, borderRadius, shadows } = useTheme();
  const [tables, setTables] = useState([]);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadLayout = async () => {
        try {
          const res = await adminLayoutService.getAdminLayout();
          const data = adminLayoutService.extractData(res);

          setTables(data?.tables || []);
          setSeats(data?.seats || []);
        } catch (err) {
          Alert.alert("Erreur", "Impossible de charger le plan.");
        } finally {
          setLoading(false);
        }
      };

      loadLayout();
    }, [])
  );

  const handleDragEnd = async (item, payload) => {
    setSaving(true);
    const dto = {
      positionX: payload.positionX,
      positionY: payload.positionY,
    };

    try {
      if (payload.type === "table") {
        await adminOfficeTableService.updateOfficeTable(item.id ?? item.Id, dto);
        setTables((prev) =>
          prev.map((t) => ((t.id ?? t.Id) === (item.id ?? item.Id) ? { ...t, ...dto } : t))
        );
      }

      if (payload.type === "seat") {
        await adminSeatService.updateSeat(item.id ?? item.Id, dto);
        setSeats((prev) =>
          prev.map((s) => ((s.id ?? s.Id) === (item.id ?? item.Id) ? { ...s, ...dto } : s))
        );
      }
    } catch (err) {
      Alert.alert("Erreur", "Impossible d'enregistrer la nouvelle position.");
    } finally {
      setSaving(false);
    }
  };

  const getSeatColor = (isActive) => {
    return isActive ? colors.primary : colors.textSecondary;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="map" size={24} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Plan Interactif</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Faites glisser les tables et les sièges pour ajuster leur position. Les modifications sont enregistrées automatiquement.
        </Text>
        {saving && (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, marginLeft: 6 }}>Enregistrement...</Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView horizontal bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
          <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={[styles.floor, { backgroundColor: colors.surface, borderColor: colors.border, ...shadows.sm }]}>
              {/* Grid Background */}
              <View style={StyleSheet.absoluteFill}>
                <Svg width="100%" height="100%">
                  <Pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <Rect width="20" height="20" fill="transparent" />
                    <Circle cx="2" cy="2" r="1" fill={colors.border} />
                  </Pattern>
                  <Rect width="100%" height="100%" fill="url(#grid)" />
                </Svg>
              </View>

              {tables.map((table) => {
                const w = Number(table.width ?? table.Width ?? 100);
                const h = Number(table.height ?? table.Height ?? 100);
                return (
                  <DraggableItem
                    key={`table-${table.id ?? table.Id}`}
                    item={table}
                    type="table"
                    onDragEnd={handleDragEnd}
                    style={[
                      styles.table,
                      {
                        width: Math.max(w, 80),
                        height: Math.max(h, 60),
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                        ...shadows.sm,
                      },
                    ]}
                  >
                    <Ionicons name="grid-outline" size={20} color={colors.textSecondary} style={{ marginBottom: 4, opacity: 0.5 }} />
                    <Text style={{ fontSize: 12, color: colors.text, fontWeight: "600", textAlign: "center" }} numberOfLines={1}>
                      {table.name ?? table.Name}
                    </Text>
                  </DraggableItem>
                );
              })}

              {seats.map((seat) => {
                const isActive = seat.isActive ?? seat.IsActive;
                return (
                  <DraggableItem
                    key={`seat-${seat.id ?? seat.Id}`}
                    item={seat}
                    type="seat"
                    onDragEnd={handleDragEnd}
                    style={[
                      styles.seat,
                      {
                        backgroundColor: getSeatColor(isActive),
                        borderColor: colors.surface,
                        ...shadows.md,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 9, color: "#fff", fontWeight: "bold" }}>{seat.label ?? seat.Label}</Text>
                  </DraggableItem>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      </View>
    </View>
  );
};

export default AdminOfficeLayoutScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  floor: {
    width: 2000,
    height: 2000,
    margin: 20,
    borderRadius: 16,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  table: {
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    padding: 8,
  },
  seat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    position: "absolute",
  },
});