using Five68.Facades;
using Five68.Models;
using Five68.Models.Authentication;
using Five68.Utils;

namespace Five68.Services
{
	public class UserService
	{
		private readonly UserFacade userFacade_;
		private readonly UserUtils userUtils_;
		private ILogger logger_;

		public UserService(UserFacade userFacade, UserUtils userUtils)
		{
			userFacade_ = userFacade;
			userUtils_ = userUtils;
		}

		public async Task<(bool success, User? user)> TryGetUserAndCheckPasswordAsync(UserLogin loginCredentials)
		{
			User? user = await userFacade_.FindByEmailAsync(loginCredentials.Email);

			if (user is null)
			{
				return (false, null);
			}

			if (!userUtils_.CheckPassword(user, loginCredentials.Password))
			{
				return (false, null);
			}

			return (true, user);
		}
	}
}