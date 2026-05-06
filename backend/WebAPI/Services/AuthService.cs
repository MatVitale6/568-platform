using Five68.Exceptions;
using Five68.Facades;
using Five68.Models;
using Five68.Models.Authentication;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Five68.Services
{
	public class AuthService
	{
		private readonly UserService userService_;
		private readonly JwtService jwtService_;
		private readonly RefreshTokenFacade refreshTokenFacade_;

		public AuthService(UserService userService, JwtService jwtService, RefreshTokenFacade refreshTokenFacade)
		{
			userService_ = userService;
			jwtService_ = jwtService;
			refreshTokenFacade_ = refreshTokenFacade;
		}

		public async Task<Tokens> Login(UserLogin userData)
		{
			if (string.IsNullOrEmpty(userData.Email))
			{
				throw new EntityException($"Il campo {nameof(userData.Email)}  non può essere vuoto");
			}

			if (string.IsNullOrEmpty(userData.Password))
			{
				throw new EntityException($"Il campo {nameof(userData.Password)} non può essere vuoto");
			}

			(bool validUser, User? user) = await userService_.TryGetUserAndCheckPasswordAsync(userData);

			if (!validUser || user is null)
			{
				throw new UnauthorizedException("Credenziali non valide");
			}

			Tokens token = jwtService_.GenerateTokens(user.Id, user.Email) ?? throw new InternalServerErrorException("Invalid attempt");

			await refreshTokenFacade_.UpsertUserRefreshTokens(new UserRefreshTokens
			{
				RefreshToken = token.RefreshToken,
				Email = user.Email,
				ExpirationDate = DateTime.UtcNow + TimeSpan.FromDays(1)
			});

			return token;
		}

	}
}