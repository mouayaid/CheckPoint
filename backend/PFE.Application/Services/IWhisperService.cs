using Microsoft.AspNetCore.Http;
using PFE.Application.DTOs.MeetingTranscription;

namespace PFE.Application.Services;

public interface IWhisperService
{
    Task<MeetingTranscriptionDto> TranscribeAsync(int reservationId, IFormFile audioFile);
    Task<List<MeetingTranscriptionDto>> GetByReservationAsync(int reservationId);
}