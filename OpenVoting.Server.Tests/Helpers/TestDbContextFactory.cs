using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using OpenVoting.Data;

namespace OpenVoting.Server.Tests.Helpers;

internal static class TestDbContextFactory
{
	public static ApplicationDbContext CreateContext(string? name = null, bool useSqlite = false)
	{
		if (!useSqlite)
		{
			var options = new DbContextOptionsBuilder<ApplicationDbContext>()
				.UseInMemoryDatabase(name ?? Guid.NewGuid().ToString())
				.Options;

			return new ApplicationDbContext(options);
		}

		var connection = new SqliteConnection("DataSource=:memory:");
		connection.Open();

		var sqliteOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
			.UseSqlite(connection)
			.Options;

		var context = new ApplicationDbContext(sqliteOptions);
		context.Database.EnsureCreated();
		return context;
	}
}
