using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenVoting.Server;
using OpenVoting.Server.Services;

namespace OpenVoting.Server.Tests;

public class DiscordCommandRegistrarTests
{
	[Test]
	public async Task RegisterVotingCommandAsync_MissingConfig_SkipsWithoutHttpCalls()
	{
		var handler = new RecordingHttpMessageHandler();
		using var client = new HttpClient(handler)
		{
			BaseAddress = new Uri("https://discord.com/api/")
		};

		var settings = Options.Create(new Settings
		{
			Discord = new DiscordSettings
			{
				ClientId = string.Empty,
				GuildId = "guild-1",
				BotToken = "token"
			}
		});

		var registrar = new DiscordCommandRegistrar(client, settings, NullLogger<DiscordCommandRegistrar>.Instance);
		await registrar.RegisterVotingCommandAsync(CancellationToken.None);

		Assert.That(handler.Requests, Is.Empty);
	}

	[Test]
	public async Task RegisterVotingCommandAsync_CommandMissing_CreatesCommand()
	{
		var handler = new RecordingHttpMessageHandler(
			new HttpResponseMessage(HttpStatusCode.OK)
			{
				Content = new StringContent("[]", Encoding.UTF8, "application/json")
			},
			new HttpResponseMessage(HttpStatusCode.Created)
			{
				Content = new StringContent("{}", Encoding.UTF8, "application/json")
			});

		using var client = new HttpClient(handler)
		{
			BaseAddress = new Uri("https://discord.com/api/")
		};
		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bot", "token");

		var settings = Options.Create(new Settings
		{
			Discord = new DiscordSettings
			{
				ClientId = "app-1",
				GuildId = "guild-1",
				BotToken = "token"
			}
		});

		var registrar = new DiscordCommandRegistrar(client, settings, NullLogger<DiscordCommandRegistrar>.Instance);
		await registrar.RegisterVotingCommandAsync(CancellationToken.None);

		Assert.That(handler.Requests.Count, Is.EqualTo(2));
		Assert.Multiple(() =>
		{
			Assert.That(handler.Requests[0].Method, Is.EqualTo(HttpMethod.Get));
			Assert.That(handler.Requests[0].RequestUri!.PathAndQuery, Is.EqualTo("/api/applications/app-1/guilds/guild-1/commands"));
			Assert.That(handler.Requests[1].Method, Is.EqualTo(HttpMethod.Post));
			Assert.That(handler.Requests[1].RequestUri!.PathAndQuery, Is.EqualTo("/api/applications/app-1/guilds/guild-1/commands"));
		});
	}

	[Test]
	public async Task RegisterVotingCommandAsync_CommandExists_PatchesCommand()
	{
		var existingJson = "[{\"id\":\"cmd-123\",\"name\":\"voting\",\"type\":1}]";
		var handler = new RecordingHttpMessageHandler(
			new HttpResponseMessage(HttpStatusCode.OK)
			{
				Content = new StringContent(existingJson, Encoding.UTF8, "application/json")
			},
			new HttpResponseMessage(HttpStatusCode.OK)
			{
				Content = new StringContent("{}", Encoding.UTF8, "application/json")
			});

		using var client = new HttpClient(handler)
		{
			BaseAddress = new Uri("https://discord.com/api/")
		};
		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bot", "token");

		var settings = Options.Create(new Settings
		{
			Discord = new DiscordSettings
			{
				ClientId = "app-1",
				GuildId = "guild-1",
				BotToken = "token"
			}
		});

		var registrar = new DiscordCommandRegistrar(client, settings, NullLogger<DiscordCommandRegistrar>.Instance);
		await registrar.RegisterVotingCommandAsync(CancellationToken.None);

		Assert.That(handler.Requests.Count, Is.EqualTo(2));
		Assert.Multiple(() =>
		{
			Assert.That(handler.Requests[0].Method, Is.EqualTo(HttpMethod.Get));
			Assert.That(handler.Requests[1].Method.Method, Is.EqualTo("PATCH"));
			Assert.That(handler.Requests[1].RequestUri!.PathAndQuery, Is.EqualTo("/api/applications/app-1/guilds/guild-1/commands/cmd-123"));
		});
	}

	private sealed class RecordingHttpMessageHandler : HttpMessageHandler
	{
		private readonly Queue<HttpResponseMessage> _responses;
		public List<HttpRequestMessage> Requests { get; } = [];

		public RecordingHttpMessageHandler(params HttpResponseMessage[] responses)
		{
			_responses = new Queue<HttpResponseMessage>(responses);
		}

		protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
		{
			Requests.Add(request);
			if (_responses.Count == 0)
			{
				return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
				{
					Content = new StringContent("{}", Encoding.UTF8, "application/json")
				});
			}

			return Task.FromResult(_responses.Dequeue());
		}
	}
}