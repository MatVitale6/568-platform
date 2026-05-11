using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Five68.IntegrationTests;

public class Five68WebAppFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration(config =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Host=Five68-db;Port=5432;Database=Five68-test-db;Username=postgres;Password=postgres",
                ["AppSettings:JWTSettings:Secret"] = "integration-test-secret-at-least-32-bytes!!",
                ["AppSettings:JWTSettings:ExpiryMinutes"] = "60",
                ["AppSettings:JWTSettings:Issuer"] = "five68-test",
                ["AppSettings:JWTSettings:Audience"] = "five68-test",
                ["AppSettings:Crypto:WorkFactor"] = "4",
            });
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
