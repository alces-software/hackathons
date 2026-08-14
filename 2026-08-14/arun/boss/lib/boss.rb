class Boss
  attr_reader :name
  attr_accessor :health

  def initialize(name)
    @name = name
    @health = 100
  end

  def take_damage(amount)
    @health -= amount
    @health = 0 if @health < 0
  end
end
