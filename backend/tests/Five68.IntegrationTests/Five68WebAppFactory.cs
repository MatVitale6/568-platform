using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Five68.IntegrationTests;

public class Five68WebAppFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
	protected override void ConfigureWebHost(IWebHostBuilder builder)
	{
		builder.ConfigureAppConfiguration(config =>
		{
			config.AddInMemoryCollection(new Dictionary<string, string?>
			{
				["AppSettings:Crypto:WorkFactor"] = "4",
			});
		});

		builder.ConfigureLogging(logging =>
		{
			logging.AddFilter("Microsoft.EntityFrameworkCore", LogLevel.Warning);
		});
	}

	public async Task InitializeAsync()
	{
		using var scope = Services.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<Five68DbContext>();
		await db.Database.EnsureCreatedAsync();
	}

	public new async Task DisposeAsync()
	{
		using var scope = Services.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<Five68DbContext>();
		await db.Database.EnsureDeletedAsync();
		await base.DisposeAsync();
	}
}
