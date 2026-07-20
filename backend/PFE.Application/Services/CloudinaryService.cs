using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using PFE.Application.Common.Exceptions;

namespace PFE.Application.Services
{
    public sealed record CloudinaryImageUploadResult(string SecureUrl, string PublicId);

    public class CloudinaryService
    {
        private const long MaxImageFileSizeBytes = 5 * 1024 * 1024;

        private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".webp", ".gif"
        };

        private static readonly HashSet<string> AllowedImageContentTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        };

        private static readonly HashSet<string> ProfileImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".webp"
        };

        private static readonly HashSet<string> ProfileImageContentTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg",
            "image/png",
            "image/webp"
        };

        private readonly Cloudinary _cloudinary;

        public CloudinaryService(IConfiguration config)
        {
            var account = new Account(
                config["Cloudinary:CloudName"],
                config["Cloudinary:ApiKey"],
                config["Cloudinary:ApiSecret"]
            );

            _cloudinary = new Cloudinary(account);
        }

        public async Task<string?> UploadImageAsync(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return null;

            ValidateImage(file);
            var uploadResult = await UploadImageInternalAsync(file, "pfe/announcements");

            return uploadResult.SecureUrl;
        }

        public async Task<CloudinaryImageUploadResult?> UploadProfileImageAsync(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return null;

            ValidateImage(file, ProfileImageExtensions, ProfileImageContentTypes);
            return await UploadImageInternalAsync(file, "checkpoint/profile-images");
        }

        public async Task DeleteImageAsync(string? publicId)
        {
            if (string.IsNullOrWhiteSpace(publicId))
                return;

            var deleteParams = new DeletionParams(publicId)
            {
                ResourceType = ResourceType.Image
            };

            await _cloudinary.DestroyAsync(deleteParams);
        }

        private async Task<CloudinaryImageUploadResult> UploadImageInternalAsync(IFormFile file, string folder)
        {
            await using var stream = file.OpenReadStream();

            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = folder
            };

            var uploadResult = await _cloudinary.UploadAsync(uploadParams);
            var secureUrl = uploadResult.SecureUrl?.ToString();

            if (uploadResult.Error != null || string.IsNullOrWhiteSpace(secureUrl) || string.IsNullOrWhiteSpace(uploadResult.PublicId))
            {
                throw new BadRequestException("Image upload failed.");
            }

            return new CloudinaryImageUploadResult(secureUrl, uploadResult.PublicId);
        }

        private static void ValidateImage(
            IFormFile file,
            HashSet<string>? allowedExtensions = null,
            HashSet<string>? allowedContentTypes = null)
        {
            allowedExtensions ??= AllowedImageExtensions;
            allowedContentTypes ??= AllowedImageContentTypes;

            if (file.Length > MaxImageFileSizeBytes)
                throw new BadRequestException("Image file must be 5 MB or smaller.");

            var extension = Path.GetExtension(file.FileName);
            if (string.IsNullOrWhiteSpace(extension) || !allowedExtensions.Contains(extension))
                throw new BadRequestException("Unsupported image file extension.");

            if (string.IsNullOrWhiteSpace(file.ContentType) ||
                !allowedContentTypes.Contains(file.ContentType))
            {
                throw new BadRequestException("Unsupported image content type.");
            }

            if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                throw new BadRequestException("Only image uploads are allowed.");
        }
    }
}
