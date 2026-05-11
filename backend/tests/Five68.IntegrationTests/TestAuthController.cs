using System.Net;
using System.Net.Http.Json;
using Five68.Models;
using Five68.Models.Authentication;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace Five68.IntegrationTests;

public class TestAuthController : IClassFixture<Five68WebAppFactory>
{
    private readonly HttpClient client_;
    private readonly Five68WebAppFactory factory_;

    private const string TestEmail = "test@five68.com";
    private const string TestPassword = "ValidP@ss1!";

    public TestAuthController(Five68WebAppFactory factory)
    {
        factory_ = factory;
        client_ = factory.CreateClient();
        SeedUser(TestEmail, TestPassword);
    }

    private void SeedUser(string email, string password)
    {
        using var scope = factory_.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Five68DbContext>();

        if (db.Users.Any(u => u.Email == email))
            return;

        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 4),
            FullName = "Test User",
            Role = UserRole.Admin,
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task Login_ValidCredentials_Returns200WithTokens()
    {
        var response = await client_.PostAsJsonAsync("/auth/login", new UserLogin
        {
            Email = TestEmail,
            Password = TestPassword
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var tokens = await response.Content.ReadFromJsonAsync<Tokens>();
        tokens!.AccessToken.Should().NotBeNullOrEmpty();
        tokens.RefreshToken.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var response = await client_.PostAsJsonAsync("/auth/login", new UserLogin
        {
            Email = TestEmail,
            Password = "WrongP@ss1!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_EmptyEmail_Returns400()
    {
        var response = await client_.PostAsJsonAsync("/auth/login", new UserLogin
        {
            Email = "",
            Password = TestPassword
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Login_UnknownEmail_Returns401()
    {
        var response = await client_.PostAsJsonAsync("/auth/login", new UserLogin
        {
            Email = "nobody@five68.com",
            Password = TestPassword
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
