class Player
  attr_accessor :health

  def initialize
    @health = 100
  end

  def take_damage(amount)
    @health -= amount
    @health = 0 if @health.negative?
  end

  def heal(amount)
    @health += amount
    @health = 100 if @health < 100
  end
end
