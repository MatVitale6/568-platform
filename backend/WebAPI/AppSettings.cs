using Easy_Password_Validator.Models;

namespace Five68
{
	public class AppSettings
	{
		public const string Position = "AppSettings";

		public CryptoSettings Crypto { get; set; } = new();
		public PasswordRequirements PasswordRequirements { get; set; } = new();
		public JWTSettings JWTSettings { get; set; } = new();
	}

	public class CryptoSettings
	{
		public int WorkFactor { get; init; }
	}

	public class JWTSettings
	{
		public string Secret { get; init; } = string.Empty;
		public int ExpiryMinutes { get; init; }
		public string Issuer { get; init; } = string.Empty;
		public string Audience { get; init; } = string.Empty;
	}
}