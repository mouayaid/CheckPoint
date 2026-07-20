using PFE.Application.DTOs.Notification;

namespace PFE.Application.DTOs.Notification;

public sealed record NotificationDeliveryJob(
    int UserId,
    NotificationDto Notification,
    string Title,
    string Body,
    string? ExpoPushToken,
    string Type,
    string? RelatedEntityType,
    int? RelatedEntityId);

