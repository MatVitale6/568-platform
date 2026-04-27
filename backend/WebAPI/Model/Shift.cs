namespace Five68.Model
{
	public class Shift
	{
		public required Guid Id { get; set; }
		public required DateTime WorkDate { get; set; }
		public bool IsClosed { get; set; } = false;
		public Guid? CreatedBy { get; set; }
		public DateTime CreatedAt { get; set; }
		public DateTime UpdatedAt { get; set; }

		public Profile Creator { get; set; } = null!;
		public ICollection<ShiftAssignment> Assignments { get; set; } = [];
		public ICollection<SwapRequest> SwapRequests { get; set; } = [];
	}
}