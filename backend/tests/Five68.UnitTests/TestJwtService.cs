using Five68.Models.Authentication;
using Five68.Services;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using NSubstitute;
using Microsoft.Extensions.Logging;

namespace Five68.UnitTests;

public class JwtServiceTests
{
	private readonly JwtService sut_;

	// Costanti condivise tra generazione e verifica
	private const string Secret = "super-secret-key-at-least-32-bytes!!";
	private const string Issuer = "five68-test";
	private const string Audience = "five68-client";

	public JwtServiceTests()
	{
		var settings = Options.Create(new AppSettings
		{
			JWTSettings = new JWTSettings
			{
				Secret = Secret,
				ExpiryMinutes = 60,
				ValidIssuer = Issuer,
				ValidAudience = Audience
			}
		});

		var logger = Substitute.For<ILogger<JwtService>>();
		sut_ = new JwtService(settings, logger);
	}

	[Fact]
	public void GenerateTokens_ValidInput_ReturnsBothTokens()
	{
		var tokens = sut_.GenerateTokens(Guid.NewGuid(), "admin@five68.com");

		tokens.AccessToken.Should().NotBeNullOrEmpty();
		tokens.RefreshToken.Should().NotBeNullOrEmpty();
	}

	[Fact]
	public void GenerateTokens_AccessToken_ContainsCorrectEmailClaim()
	{
		var email = "admin@five68.com";
		var tokens = sut_.GenerateTokens(Guid.NewGuid(), email);

		var handler = new JwtSecurityTokenHandler();
		var jwt = handler.ReadJwtToken(tokens.AccessToken);

		jwt.Claims
			.First(c => c.Type == JwtRegisteredClaimNames.Email)
			.Value.Should().Be(email);
	}

	[Fact]
	public void GenerateTokens_AccessToken_IsValidSignature()
	{
		var tokens = sut_.GenerateTokens(Guid.NewGuid(), "admin@five68.com");

		var handler = new JwtSecurityTokenHandler();
		var validationParams = new TokenValidationParameters
		{
			ValidateIssuerSigningKey = true,
			IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Secret)),
			ValidateIssuer = true,
			ValidIssuer = Issuer,
			ValidateAudience = true,
			ValidAudience = Audience,
			ValidateLifetime = true,
			ClockSkew = TimeSpan.Zero
		};

		var act = () => handler.ValidateToken(tokens.AccessToken, validationParams, out _);

		act.Should().NotThrow();
	}

	[Fact]
	public void GenerateTokens_TwoCallsSameUser_ReturnDifferentRefreshTokens()
	{
		var id = Guid.NewGuid();
		var t1 = sut_.GenerateTokens(id, "admin@five68.com");
		var t2 = sut_.GenerateTokens(id, "admin@five68.com");

		t1.RefreshToken.Should().NotBe(t2.RefreshToken);
	}

	[Fact]
	public void Constructor_SecretTooShort_ThrowsInvalidOperationException()
	{
		var badSettings = Options.Create(new AppSettings
		{
			JWTSettings = new JWTSettings { Secret = "short", ExpiryMinutes = 60 }
		});

		Action act = () => new JwtService(badSettings, Substitute.For<ILogger<JwtService>>());

		act.Should().Throw<InvalidOperationException>()
			.WithMessage("*32 bytes*");
	}
}