using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
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

        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddScoped<IOfficeLayoutService, OfficeLayoutService>();


builder.Services.AddScoped<CloudinaryService>();
builder.Services.AddScoped<INotificationPushService, SignalRNotificationPushService>();
builder.Services.AddHttpClient<IOllamaMeetingInsightService, OllamaMeetingInsightService>(client =>
{
    client.BaseAddress = new Uri("http://localhost:11434/");
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
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "PFE.API";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "PFE.Client";

if (!builder.Environment.IsDevelopment())
{
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

var swaggerEnabled =
    app.Environment.IsDevelopment() ||
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

app.UseCors("AllowReactNative");

app.UseAuthentication();
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
