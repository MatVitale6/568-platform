namespace Five68.Models
{
	public class User
	{
		public required Guid Id { get; set; }
		public Guid? AuthUserId { get; set; } // to link to auth system
		public string Password { get; set; }
		public required string FullName { get; set; }
		public required string Email { get; set; }
		public required UserRole Role { get; set; }
		public string? Color { get; set; }
		public bool FirstLoginCompleted { get; set; } = false;
		public DateTime CreatedAt { get; set; } = DateTime.Now;
		public DateTime UpdatedAt { get; set; } = DateTime.Now;

		// Navigation
		public Employee? Employee { get; set; }
	}
}