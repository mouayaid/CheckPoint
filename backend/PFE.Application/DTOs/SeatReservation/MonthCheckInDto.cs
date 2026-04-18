using PFE.Domain.Enums;
using System;

namespace PFE.Application.DTOs.SeatReservation
{
    public class MonthCheckInDto
    {
        public DateTime Date { get; set; }
        public SeatReservationStatus Status { get; set; }
        public DateTime? CheckedInAt { get; set; }
    }
}

