using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PFE.Application.Common;
using PFE.Application.Abstractions;
using PFE.Application.Mapping;
using PFE.Application.Services;
using PFE.Infrastructure.Services;
using PFE.Infrastructure.Repositories;
using PFE.API.Middlewares;
using PFE.Infrastructure.Data;
using System.Text.Json.Serialization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using PFE.API.Hubs;
using Microsoft.AspNetCore.SignalR;
using PFE.API.Services;





var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

static string RequireConfigurationValue(
    IConfiguration configuration,
    string key)
{
    var value = configuration[key];
    if (string.IsNullOrWhiteSpace(value))
    {
        throw new InvalidOperationException(
            $"Required configuration '{key}' is missing.");
    }

    return value;
}

static void RequireStrongJwtKey(string key)
{
    if (Encoding.UTF8.GetByteCount(key) < 32)
    {
        throw new InvalidOperationException(
            "Required configuration 'Jwt:Key' must be at least 32 bytes long.");
    }
}

static int RequirePositiveIntConfigurationValue(
    IConfiguration configuration,
    string key)
{
    var value = RequireConfigurationValue(configuration, key);
    if (!int.TryParse(value, out var parsed) || parsed <= 0)
    {
        throw new InvalidOperationException(
            $"Required configuration '{key}' must be a positive integer.");
    }

    return parsed;
}

static void ValidateProductionOrigin(string origin)
{
    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
        uri.Scheme != Uri.UriSchemeHttps ||
        uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
        uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "Production CORS origins must be explicit HTTPS origins.");
    }
}

static string GetRemoteIpPartitionKey(HttpContext context) =>
    context.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";

static string GetUserOrIpPartitionKey(HttpContext context)
{
    var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    return !string.IsNullOrWhiteSpace(userId)
        ? $"user:{userId}"
        : $"ip:{GetRemoteIpPartitionKey(context)}";
}

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .SelectMany(entry => entry.Value!.Errors.Select(error =>
                $"{entry.Key}: {error.ErrorMessage}"))
            .ToList();

        return new BadRequestObjectResult(
            ApiResponse<object>.ErrorResponse("Validation failed.", errors));
    };
});
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "PFE API",
        Version = "v1",
        Description = "Internal Company Mobile App API"
    });
    c.CustomSchemaIds(type => type.FullName);

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactNative", policy =>
    {
        var allowedOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>()
            ?.Where(origin => !string.IsNullOrWhiteSpace(origin))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray() ?? Array.Empty<string>();

        if (!builder.Environment.IsDevelopment() && allowedOrigins.Length == 0)
        {
            throw new InvalidOperationException(
                "At least one production CORS origin must be configured in 'Cors:AllowedOrigins'.");
        }

        if (!builder.Environment.IsDevelopment())
        {
            foreach (var origin in allowedOrigins)
            {
                ValidateProductionOrigin(origin);
            }
        }

        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter =
                Math.Ceiling(retryAfter.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture);
        }

        context.HttpContext.Response.ContentType = "application/json";
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

        var result = System.Text.Json.JsonSerializer.Serialize(
            ApiResponse<object>.ErrorResponse("Too many requests. Please try again later."),
            new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase });

        await context.HttpContext.Response.WriteAsync(result, cancellationToken);
    };

    options.AddPolicy("AuthenticationPolicy", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetRemoteIpPartitionKey(context),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("PasswordRecoveryPolicy", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetRemoteIpPartitionKey(context),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 3,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("QrScanPolicy", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetUserOrIpPartitionKey(context),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 15,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("TranscriptionUploadPolicy", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetUserOrIpPartitionKey(context),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 2,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

builder.Services.AddScoped<IOfficeLayoutService, OfficeLayoutService>();


builder.Services.AddScoped<CloudinaryService>();
builder.Services.AddScoped<INotificationPushService, SignalRNotificationPushService>();
builder.Services.AddSingleton<INotificationDeliveryQueue, NotificationDeliveryQueue>();
builder.Services.AddHostedService<NotificationDeliveryBackgroundService>();
builder.Services.AddSingleton<IExpoPushReceiptQueue, ExpoPushReceiptQueue>();
builder.Services.AddHostedService<ExpoPushReceiptBackgroundService>();
builder.Services.AddHttpClient("ExpoPush", client =>
{
    client.BaseAddress = new Uri("https://exp.host/--/api/v2/push/");
    client.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddHttpClient<IExpoPushNotificationService, ExpoPushNotificationService>(client =>
{
    client.BaseAddress = new Uri("https://exp.host/--/api/v2/push/");
    client.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddHttpClient<IOllamaMeetingInsightService, OllamaMeetingInsightService>(client =>
{
    var ollamaBaseUrl = builder.Configuration["Ollama:BaseUrl"];
    if (!string.IsNullOrWhiteSpace(ollamaBaseUrl))
    {
        if (!Uri.TryCreate(ollamaBaseUrl, UriKind.Absolute, out var ollamaUri))
        {
            throw new InvalidOperationException(
                "Configuration 'Ollama:BaseUrl' must be an absolute URL.");
        }

        client.BaseAddress = ollamaUri;
    }

    client.Timeout = TimeSpan.FromMinutes(2);
});
builder.Services.AddScoped<IWhisperService, WhisperService>();



// Database - EF Core with SQL Server
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Required configuration 'ConnectionStrings:DefaultConnection' is missing.");
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        connectionString,
        b => b.MigrationsAssembly("PFE.Infrastructure")));

builder.Services.AddScoped<IApplicationDbContext>(sp =>
sp.GetRequiredService<ApplicationDbContext>());

// JWT Authentication
var jwtKey = RequireConfigurationValue(builder.Configuration, "Jwt:Key");
RequireStrongJwtKey(jwtKey);
RequirePositiveIntConfigurationValue(builder.Configuration, "Jwt:AccessTokenMinutes");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "PFE.API";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "PFE.Client";

if (!builder.Environment.IsDevelopment())
{
    var allowedHosts = builder.Configuration["AllowedHosts"];
    if (string.IsNullOrWhiteSpace(allowedHosts) || allowedHosts.Trim() == "*")
    {
        throw new InvalidOperationException(
            "Production 'AllowedHosts' must be configured to explicit host names.");
    }

    RequireConfigurationValue(builder.Configuration, "Cloudinary:CloudName");
    RequireConfigurationValue(builder.Configuration, "Cloudinary:ApiKey");
    RequireConfigurationValue(builder.Configuration, "Cloudinary:ApiSecret");
    RequireConfigurationValue(builder.Configuration, "Email:SmtpHost");
    RequireConfigurationValue(builder.Configuration, "Email:SmtpPort");
    RequireConfigurationValue(builder.Configuration, "Email:Username");
    RequireConfigurationValue(builder.Configuration, "Email:Password");
    RequireConfigurationValue(builder.Configuration, "Email:From");
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) &&
                path.StartsWithSegments("/hubs/notifications"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        },
        OnTokenValidated = async context =>
        {
            var userIdClaim = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
            {
                context.Fail("Invalid user claim.");
                return;
            }

            try
            {
                var dbContext = context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
                var userState = await dbContext.Users
                    .AsNoTracking()
                    .Include(u => u.Role)
                    .Where(u => u.Id == userId)
                    .Select(u => new
                    {
                        u.IsActive,
                        u.RejectedAt,
                        RoleName = u.Role.Name
                    })
                    .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

                if (userState == null ||
                    !userState.IsActive ||
                    userState.RejectedAt != null ||
                    userState.RoleName is not ("Employee" or "Manager" or "Admin"))
                {
                    context.Fail("User account is inactive or invalid.");
                }
            }
            catch (Exception ex)
            {
                var logger = context.HttpContext.RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger("JwtAccountStateValidation");

                logger.LogError(ex, "Failed to validate authenticated user account state for user {UserId}.", userId);
                context.Fail("Unable to validate user account state.");
            }
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("EmployeeOnly", policy => policy.RequireRole("Employee"));
    options.AddPolicy("ManagerOnly", policy => policy.RequireRole("Manager"));
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    options.AddPolicy("ManagerOrAdmin", policy => policy.RequireRole("Manager", "Admin"));
    options.AddPolicy("AllRoles", policy => policy.RequireRole("Employee", "Manager", "Admin"));
});

// AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfile));

builder.Services.AddScoped<IUserRepository, UserRepository>();

builder.Services.AddSingleton<IAppTimeProvider, AppTimeProvider>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ISeatService, SeatService>();
builder.Services.AddScoped<ISeatReservationService, SeatReservationService>();
builder.Services.AddScoped<IRoomService, RoomService>();
builder.Services.AddScoped<IRoomReservationService, RoomReservationService>();
builder.Services.AddScoped<IGeneralRequestService, GeneralRequestService>();
builder.Services.AddScoped<IProfileService, ProfileService>();
builder.Services.AddScoped<ILeaveService, LeaveService>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IAdminUserService, AdminUserService>();
builder.Services.AddScoped<IAdminStatisticsService, AdminStatisticsService>();
builder.Services.AddScoped<IAdminChatbotService, AdminChatbotService>();
builder.Services.AddScoped<IDepartmentChannelService, DepartmentChannelService>();
builder.Services.AddScoped<IAnnouncementService, AnnouncementService>();
builder.Services.AddScoped<IOfficeTableService, OfficeTableService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddSignalR();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var connection = db.Database.GetDbConnection();

}

var swaggerEnabled =
    app.Environment.IsDevelopment() &&
    app.Configuration.GetValue<bool>("Swagger:Enabled");

if (swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "PFE API v1");
        c.RoutePrefix = "swagger";
    });
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseMiddleware<ErrorHandlingMiddleware>();

app.UseRouting();

app.UseCors("AllowReactNative");

app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapHub<NotificationHub>("/hubs/notifications");

app.MapControllers();


// Seed database in development
if (app.Environment.IsDevelopment())
{
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        try
        {
            await PFE.Infrastructure.Data.DbSeeder.SeedAsync(context);
        }
        catch (Exception ex)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            logger.LogError(ex, "An error occurred while seeding the database.");
        }
    }
}

app.Run();
