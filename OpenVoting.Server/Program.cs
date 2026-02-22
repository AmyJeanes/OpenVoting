using System.Net.Http.Headers;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenVoting.Data;
using OpenVoting.Server;
using OpenVoting.Server.Auth;
using OpenVoting.Server.Services;
using Azure.Storage.Blobs;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHealthChecks();
builder.Services.Configure<Settings>(builder.Configuration.GetSection("Settings"));
builder.Services.AddMemoryCache();

var connectionString = builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Connection string 'Database' not found");
var jwtSettings = builder.Configuration.GetSection("Settings:Jwt").Get<JwtSettings>() ?? throw new InvalidOperationException("JWT settings not configured");

builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connectionString));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
	.AddJwtBearer(options =>
	{
		options.MapInboundClaims = false;
		options.TokenValidationParameters = new TokenValidationParameters
		{
			ValidateIssuer = true,
			ValidateAudience = true,
			ValidateIssuerSigningKey = true,
			ValidIssuer = jwtSettings.Issuer,
			ValidAudience = jwtSettings.Audience,
			IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey)),
			ClockSkew = TimeSpan.FromMinutes(1)
		};
	});

builder.Services.AddAuthorization();

builder.Services.AddHttpClient<IDiscordOAuthService, DiscordOAuthService>(client =>
{
	client.BaseAddress = new Uri("https://discord.com/api/");
});

builder.Services.AddHttpClient<IDiscordGuildService, DiscordGuildService>((sp, client) =>
{
	var settings = sp.GetRequiredService<IOptions<Settings>>().Value;
	client.BaseAddress = new Uri("https://discord.com/api/");
	if (!string.IsNullOrWhiteSpace(settings.Discord.BotToken))
	{
		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bot", settings.Discord.BotToken);
	}
});

builder.Services.AddHttpClient<IDiscordCommandRegistrar, DiscordCommandRegistrar>((sp, client) =>
{
	var settings = sp.GetRequiredService<IOptions<Settings>>().Value;
	client.BaseAddress = new Uri("https://discord.com/api/");
	if (!string.IsNullOrWhiteSpace(settings.Discord.BotToken))
	{
		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bot", settings.Discord.BotToken);
	}
});
builder.Services.AddHostedService<DiscordCommandRegistrationHostedService>();

builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<IOneTimeLoginLinkService, OneTimeLoginLinkService>();
builder.Services.AddSingleton<BlobServiceClient>(sp =>
{
	var settings = sp.GetRequiredService<IOptions<Settings>>().Value;
	return new BlobServiceClient(settings.BlobStorage.ConnectionString);
});
builder.Services.AddSingleton<IAssetStorage, BlobAssetStorage>();
builder.Services.AddScoped<IVoteService, VoteService>();
builder.Services.AddScoped<IPollEntryService, PollEntryService>();
builder.Services.AddScoped<IPollService, PollService>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
	options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
	options.KnownIPNetworks.Clear();
	options.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();

app.UseDefaultFiles();
app.MapStaticAssets();

app.UseHealthChecks(new PathString("/healthz"));

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
