namespace Five68.Models
{
	public class User
	{
		public required Guid Id { get; set; }
		public required string Email { get; set; }
		public string? PasswordHash { get; set; }
		public UserStatus Status { get; set; }
		public required string FullName { get; set; }
		public required UserRole Role { get; set; }
		public string? Color { get; set; }
		public string? InviteToken { get; set; }
		public DateTime? InviteTokenExpiry { get; set; }
		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
		public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

		// Navigation
		public Employee? Employee { get; set; }
	}
}